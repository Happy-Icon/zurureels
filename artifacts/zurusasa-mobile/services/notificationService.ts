import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  supabase,
  type NotificationRow,
  type NotificationType,
  type NotificationActionType,
} from '@/lib/supabase';

const EAS_PROJECT_ID = '7288bdeb-4a70-4035-9563-587a72f32534';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');

  // 1. Configure foreground notification display behavior (SDK 52+ format)
  Notifications?.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // 2. Configure Android high-importance notification channel
  if (Platform.OS === 'android' && Notifications?.setNotificationChannelAsync) {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default Channel',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F26522',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    }).catch((err: any) => console.warn('[Push] Android channel setup note:', err?.message || err));
  }
} catch (e) {
  console.log('[Push] expo-notifications initialization note:', e);
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  imageUrl?: string | null;
  actionType?: NotificationActionType | null;
  actionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const notificationService = {
  /**
   * Fetch all in-app notifications for a user
   */
  async fetchNotifications(userId: string): Promise<NotificationRow[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as NotificationRow[]) ?? [];
    } catch (err) {
      console.warn('[Push] Error fetching notifications:', err);
      return [];
    }
  },

  /**
   * Fetch unread notification count
   */
  async fetchUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count ?? 0;
    } catch (err) {
      console.warn('[Push] Error fetching unread count:', err);
      return 0;
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[Push] Error marking notification read:', err);
      return false;
    }
  },

  /**
   * Mark all notifications for user as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[Push] Error marking all notifications read:', err);
      return false;
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[Push] Error deleting notification:', err);
      return false;
    }
  },

  /**
   * Create a new in-app notification entry and trigger server-side Expo Push dispatch
   * via the authenticated 'dispatch-notification' Edge Function.
   */
  async createNotification(params: CreateNotificationParams): Promise<NotificationRow | null> {
    try {
      const metadataPayload: Record<string, unknown> = {
        ...(params.metadata ?? {}),
        ...(params.imageUrl ? { image_url: params.imageUrl } : {}),
        ...(params.actionType ? { action_type: params.actionType } : {}),
        ...(params.actionId ? { action_id: params.actionId } : {}),
      };

      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke(
        'dispatch-notification',
        {
          body: {
            recipientId: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            imageUrl: params.imageUrl ?? null,
            actionType: params.actionType ?? null,
            actionId: params.actionId ?? null,
            metadata: metadataPayload,
            data: {
              type: params.type,
              actionType: params.actionType,
              actionId: params.actionId,
              conversationId: params.actionId,
            },
            createInApp: true,
            sendPush: true,
          },
        },
      );

      if (!edgeErr && edgeData?.notification) {
        return edgeData.notification as NotificationRow;
      }

      if (edgeErr) {
        console.warn('[Push] dispatch-notification invoke note:', edgeErr.message || edgeErr);
      }

      // Fallback for in-app record persistence via relationship-checked Security Definer RPC
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('send_notification', {
        p_user_id: params.userId,
        p_type: params.type,
        p_title: params.title,
        p_message: params.message,
        p_metadata: metadataPayload,
      });

      if (!rpcErr && rpcRes && (rpcRes as any).success && (rpcRes as any).id) {
        return {
          id: String((rpcRes as any).id),
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          is_read: false,
          created_at: new Date().toISOString(),
        } as NotificationRow;
      }

      return null;
    } catch (err) {
      console.warn('[Push] Error creating notification:', err);
      return null;
    }
  },

  /**
   * Dispatch push notification to all registered active devices for a recipient via
   * the server-side 'dispatch-notification' Edge Function (respects user_devices RLS
   * without exposing recipient device tokens to the client).
   */
  async sendPushNotificationForUser(
    recipientId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const notifType = typeof data?.type === 'string' ? data.type : 'notification';
      const actionType = typeof data?.actionType === 'string' ? data.actionType : null;
      const actionId =
        typeof data?.actionId === 'string'
          ? data.actionId
          : typeof data?.bookingId === 'string'
            ? data.bookingId
            : null;

      const { error } = await supabase.functions.invoke('dispatch-notification', {
        body: {
          recipientId,
          type: notifType,
          title,
          message: body,
          actionType,
          actionId,
          data: data ?? {},
          createInApp: false,
          sendPush: true,
        },
      });

      if (error) {
        console.warn('[Push] dispatch-notification push error:', error.message || error);
      }
    } catch (err) {
      console.warn('[Push] Error sending push notification for user:', err);
    }
  },

  /**
   * Register or refresh Expo push token in canonical user_devices table
   */
  async registerPushToken(userId: string): Promise<string | null> {
    if (Platform.OS === 'web' || !Notifications) return null;

    try {
      // 1. Permission request & detection
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permission: denied');
        return null;
      }
      console.log('[Push] Permission: granted');

      // 2. Configure Android channel if on Android
      if (Platform.OS === 'android' && Notifications?.setNotificationChannelAsync) {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default Channel',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#F26522',
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      // 3. Fetch Expo Push Token with EAS Project ID
      const isExpoGo =
        Constants.appOwnership === 'expo' ||
        (Constants as any).executionEnvironment === 'storeClient';

      if (isExpoGo && Platform.OS === 'android') {
        console.log(
          '[Push] Running in Expo Go on Android: Remote push notifications were removed in Expo SDK 53+. Use an EAS Development Build for remote push. Local notifications remain active.',
        );
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId ??
        EAS_PROJECT_ID;

      let token: string | null = null;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        token = tokenData?.data ?? null;
      } catch (tokenErr: any) {
        console.warn('[Push] getExpoPushTokenAsync with projectId error:', tokenErr?.message || tokenErr);
        try {
          const fallbackToken = await Notifications.getExpoPushTokenAsync();
          token = fallbackToken?.data ?? null;
        } catch (fallbackErr: any) {
          console.warn(
            '[Push] Push token generation error. Note: Standalone APKs require Firebase Cloud Messaging (google-services.json & FCM V1) configured in EAS to generate remote push tokens:',
            fallbackErr?.message || fallbackErr,
          );
          token = null;
        }
      }

      if (!token) {
        console.log('[Push] Token received: NO');
        return null;
      }

      const fingerprint = token.length > 10 ? `...${token.slice(-6)}` : token;
      console.log(`[Push] Token received: YES (fingerprint: ${fingerprint})`);

      // 4. Save token into user_devices table via RPC first
      let saved = false;
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('register_device_push_token', {
          p_push_token: token,
          p_device_type: Platform.OS,
        });

        if (!rpcErr && (rpcData as any)?.success) {
          console.log(`[Push] Token registration: SUCCESS (deviceId: ${(rpcData as any)?.id || 'registered'})`);
          saved = true;
        } else if (rpcErr) {
          console.warn('[Push] register_device_push_token RPC note:', rpcErr.message || rpcErr);
        }
      } catch (rpcEx) {
        console.warn('[Push] register_device_push_token RPC call exception:', rpcEx);
      }

      if (!saved) {
        // Fallback: Direct select & insert/update on own user_devices row
        try {
          const { data: existingDevice } = await supabase
            .from('user_devices')
            .select('id')
            .eq('user_id', userId)
            .or(`push_token.eq.${token},device_token.eq.${token}`)
            .maybeSingle();

          if (existingDevice?.id) {
            const { error: updateErr } = await supabase
              .from('user_devices')
              .update({
                is_active: true,
                push_token: token,
                device_token: token,
                device_type: Platform.OS,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingDevice.id);

            if (updateErr) {
              console.warn('[Push] Direct device update note:', updateErr.message);
            } else {
              console.log('[Push] Token registration: SUCCESS (updated existing device)');
              saved = true;
            }
          } else {
            const { error: insertErr } = await supabase
              .from('user_devices')
              .insert({
                user_id: userId,
                push_token: token,
                device_token: token,
                device_type: Platform.OS,
                is_active: true,
                updated_at: new Date().toISOString(),
              });

            if (insertErr) {
              console.warn('[Push] Direct device insert note:', insertErr.message);
            } else {
              console.log('[Push] Token registration: SUCCESS (new device inserted)');
              saved = true;
            }
          }
        } catch (directErr) {
          console.warn('[Push] Direct device registration note:', directErr);
        }
      }

      return token;
    } catch (err: any) {
      console.warn('[Push] Error registering push token:', err?.message || err);
      return null;
    }
  },

  /**
   * Deactivate device push token on logout to prevent cross-account push bleeding
   */
  async deactivatePushToken(userId: string): Promise<boolean> {
    try {
      if (!userId) return false;
      const { error } = await supabase
        .from('user_devices')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.warn('[Push] Deactivate token note:', error.message);
        return false;
      }
      console.log(`[Push] Push token deactivated for user ${userId.slice(0, 8)}...`);
      return true;
    } catch (err) {
      console.warn('[Push] Error deactivating push token:', err);
      return false;
    }
  },

  /**
   * Triggers a test push notification locally & creates server-dispatched notification
   */
  async triggerTestPush(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (Notifications?.scheduleNotificationAsync) {
        try {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;

          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }

          if (finalStatus === 'granted') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🌴 ZuruSasa Coastal Alert',
                body: 'Test Push Notification: Your booking alerts and trip reminders are working correctly!',
                sound: 'default',
                channelId: 'default',
                data: { type: 'test_push', timestamp: new Date().toISOString() },
              },
              trigger: null,
            });
          }
        } catch (e) {
          console.warn('[Push] Local push scheduling note:', e);
        }
      }

      if (userId) {
        await this.createNotification({
          userId,
          type: 'booking_confirmed',
          title: '🌴 ZuruSasa Test Push Notification',
          message: 'Your push notification channel is active and receiving travel alerts.',
          actionType: 'booking',
        });
      }

      return { success: true };
    } catch (err: any) {
      console.warn('[Push] Error triggering test push:', err);
      return {
        success: false,
        error: err?.message || 'Failed to trigger test push notification on device.',
      };
    }
  },

  /**
   * Immediately displays a native local notification banner on the device
   */
  async presentLocalNotification(params: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    if (Platform.OS === 'web' || !Notifications) return;
    try {
      if (Notifications.scheduleNotificationAsync) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: params.title,
            body: params.body,
            sound: 'default',
            channelId: 'default',
            data: params.data ?? {},
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.log('[Push] Local notification presentation note:', err);
    }
  },
};
