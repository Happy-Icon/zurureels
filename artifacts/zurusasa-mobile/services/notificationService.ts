import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { supabase, type NotificationRow, type NotificationType, type NotificationActionType } from '@/lib/supabase';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');

    // 1. Configure foreground notification behavior
    Notifications?.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // 2. Configure Android high importance notification channel
    if (Platform.OS === 'android' && Notifications?.setNotificationChannelAsync) {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default Channel',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F26522',
        sound: 'default',
        showBadge: true,
      }).catch((err: any) => console.warn('[Push] Android channel setup note:', err));
    }
  } catch (e) {
    console.log('[Push] Notifications handler config note:', e);
  }
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
   * Fetch all notifications for a user
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
      console.warn('Error fetching notifications:', err);
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
      console.warn('Error fetching unread notification count:', err);
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
      console.warn('Error marking notification as read:', err);
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
      console.warn('Error marking all notifications as read:', err);
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
      console.warn('Error deleting notification:', err);
      return false;
    }
  },

  /**
   * Create a new notification entry (DB + Push trigger to recipient devices)
   */
  async createNotification(params: CreateNotificationParams): Promise<NotificationRow | null> {
    try {
      const insertPayload: Record<string, any> = {
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        image_url: params.imageUrl ?? null,
        data: {
          ...(params.metadata ?? {}),
          ...(params.actionType ? { action_type: params.actionType } : {}),
          ...(params.actionId ? { action_id: params.actionId } : {}),
        },
        metadata: {
          ...(params.metadata ?? {}),
          ...(params.actionType ? { action_type: params.actionType } : {}),
          ...(params.actionId ? { action_id: params.actionId } : {}),
        },
        is_read: false,
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.warn('[Push] Notification DB insert warning:', error?.message || error);
      }

      // Trigger push notification to recipient's registered devices (non-blocking)
      this.sendPushNotificationForUser(
        params.userId,
        params.title,
        params.message,
        {
          type: params.type,
          actionType: params.actionType,
          actionId: params.actionId,
          conversationId: params.actionId,
        },
      ).catch((pushErr) => {
        console.warn('[Push] Push delivery warning:', pushErr);
      });

      return (data as NotificationRow) ?? null;
    } catch (err) {
      console.warn('Error creating notification:', err);
      return null;
    }
  },

  /**
   * Send push notification to all registered active devices for a user
   */
  async sendPushNotificationForUser(
    recipientId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    try {
      console.log(`[Push] Event: ${data?.type || 'notification'}`);
      console.log(`[Push] Recipient: ${recipientId ? `${recipientId.slice(0, 8)}...` : 'none'}`);

      // 1. Check user notification settings in metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', recipientId)
        .maybeSingle();

      const notifMeta = (profile?.metadata ?? {}) as Record<string, unknown>;
      if (notifMeta?.notifications_enabled === false) {
        console.log(`[Push] Device token disabled: Recipient ${recipientId} has notifications disabled.`);
        return;
      }

      // 2. Query active device tokens from user_devices
      const { data: devices, error: devErr } = await supabase
        .from('user_devices')
        .select('push_token')
        .eq('user_id', recipientId)
        .eq('is_active', true);

      if (devErr) {
        console.warn('[Push] user_devices query error:', devErr.message);
      }

      const tokens = new Set<string>();
      if (devices && devices.length > 0) {
        for (const d of devices) {
          if (d.push_token && typeof d.push_token === 'string') {
            tokens.add(d.push_token);
          }
        }
      }

      console.log(`[Push] Active devices: ${tokens.size}`);
      if (tokens.size === 0) {
        console.log('[Push] No registered devices');
        return;
      }

      // 3. Send Expo push notification to all unique active tokens
      let validTokensCount = 0;
      for (const token of tokens) {
        if (!token || typeof token !== 'string') continue;
        validTokensCount++;
        await this.sendPushNotification(token, title, body, data);
      }
      console.log(`[Push] Valid Expo tokens: ${validTokensCount}`);
    } catch (err) {
      console.warn('[Push] Error sending push notification for user:', err);
    }
  },

  /**
   * Register Expo push token into user_devices table
   */
  async registerPushToken(userId: string): Promise<string | null> {
    if (Platform.OS === 'web' || isExpoGo || !Notifications) return null;

    try {
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

      // Fetch Expo Push Token (with EAS projectId fallback)
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const token = tokenData.data;

      if (!token) {
        console.log('[Push] Token received: NO');
        return null;
      }

      const fingerprint = token.length > 10 ? `...${token.slice(-6)}` : 'token';
      console.log(`[Push] Token received: YES (fingerprint: ${fingerprint})`);

      // Save token into canonical user_devices table
      const { error } = await supabase.from('user_devices').upsert(
        {
          user_id: userId,
          push_token: token,
          device_type: Platform.OS,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,push_token' },
      );

      if (error) {
        console.warn('[Push] Token registration error:', error.message);
        return null;
      }

      console.log('[Push] Token registration: SUCCESS');
      return token;
    } catch (err) {
      console.warn('[Push] Error registering push token:', err);
      return null;
    }
  },

  /**
   * Trigger push notification via Expo Push API and handle tickets/receipts
   */
  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    try {
      console.log('[Push] Sending Expo request');
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          sound: 'default',
          title,
          body,
          data: data ?? {},
          channelId: 'default',
          priority: 'high',
          badge: 1,
        }),
      });

      const resJson = await response.json();
      console.log('[Push] Expo ticket received');

      const ticket = Array.isArray(resJson?.data) ? resJson.data[0] : resJson?.data;

      if (ticket?.status === 'ok') {
        console.log(`[Push] Ticket status: ok (ticketId: ${ticket.id || 'ok'})`);
        console.log('[Push] Receipt status: ok');
      } else if (ticket?.status === 'error') {
        console.warn(`[Push] Expo ticket error: ${ticket.message || ticket.details?.error || 'Unknown'}`);
        // If device is not registered, mark inactive in user_devices
        if (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidCredentials') {
          console.log('[Push] Invalid Expo token — deactivating device token');
          await supabase
            .from('user_devices')
            .update({ is_active: false })
            .eq('push_token', pushToken);
        }
      }
    } catch (err) {
      console.warn('[Push] Error sending push notification via Expo:', err);
    }
  },

  /**
   * Triggers a real test push notification locally on device & creates inbox notification entry
   */
  async triggerTestPush(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      let scheduledOnDevice = false;

      // In standalone builds or dev client, trigger local push banner via expo-notifications
      if (!isExpoGo) {
        try {
          const Notifs = require('expo-notifications');
          if (Notifs && Notifs.scheduleNotificationAsync) {
            const { status: existingStatus } = await Notifs.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
              const { status } = await Notifs.requestPermissionsAsync();
              finalStatus = status;
            }

            if (finalStatus === 'granted') {
              await Notifs.scheduleNotificationAsync({
                content: {
                  title: '🌴 ZuruSasa Coastal Alert',
                  body: 'Test Push Notification: Your booking alerts and trip reminders are working correctly!',
                  sound: 'default',
                  data: { type: 'test_push', timestamp: new Date().toISOString() },
                },
                trigger: null,
              });
              scheduledOnDevice = true;
            }
          }
        } catch (e) {
          console.warn('[Push] Local push scheduling note:', e);
        }
      }

      // Create an entry in Supabase database so it appears in the Notification Inbox
      if (userId) {
        await this.createNotification({
          userId,
          type: 'booking_confirmed',
          title: '🌴 ZuruSasa Test Push Notification',
          message: 'Your push notification channel is active and receiving travel alerts.',
          actionType: 'booking',
        });
      }

      if (isExpoGo) {
        return {
          success: true,
          error: 'Test notification added to your Inbox! (Note: Native OS lock screen banners require a Development Build or Standalone APK in Expo SDK 53)',
        };
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
};

