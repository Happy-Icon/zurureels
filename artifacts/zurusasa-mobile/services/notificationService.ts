import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  supabase,
  type NotificationRow,
  type NotificationType,
  type NotificationActionType,
} from '@/lib/supabase';

const EAS_PROJECT_ID = '7288bdeb-4a70-4035-9563-587a72f32534';
const DEVICE_TOKEN_STORAGE_KEY = '@zurusasa_active_push_token';
const REMOTE_DEDUPE_TTL_MS = 15_000;

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');

  Notifications?.setNotificationHandler?.({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

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

let inFlightRegistration: { userId: string; promise: Promise<string | null> } | null = null;
let cachedDeviceToken: string | null = null;
const recentRemoteNotificationIds = new Map<string, number>();

function pruneRemoteDedupeCache() {
  const cutoff = Date.now() - REMOTE_DEDUPE_TTL_MS;
  for (const [key, ts] of recentRemoteNotificationIds.entries()) {
    if (ts < cutoff) {
      recentRemoteNotificationIds.delete(key);
    }
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
  dedupeKey?: string | null;
}

export const notificationService = {
  markRemotePushReceived(notificationId?: string | null, fallbackKey?: string | null): void {
    pruneRemoteDedupeCache();
    const now = Date.now();
    if (notificationId) {
      recentRemoteNotificationIds.set(`id:${notificationId}`, now);
    }
    if (fallbackKey) {
      recentRemoteNotificationIds.set(`key:${fallbackKey}`, now);
    }
  },

  wasRecentlyPresentedByRemotePush(notificationId?: string | null, fallbackKey?: string | null): boolean {
    pruneRemoteDedupeCache();
    if (notificationId && recentRemoteNotificationIds.has(`id:${notificationId}`)) {
      return true;
    }
    if (fallbackKey && recentRemoteNotificationIds.has(`key:${fallbackKey}`)) {
      return true;
    }
    return false;
  },

  startForegroundPushListener(): () => void {
    if (Platform.OS === 'web' || !Notifications?.addNotificationReceivedListener) {
      return () => {};
    }
    const sub = Notifications.addNotificationReceivedListener((notification: any) => {
      const data = notification?.request?.content?.data ?? {};
      const notifId =
        typeof data.notificationId === 'string'
          ? data.notificationId
          : typeof data.id === 'string'
            ? data.id
            : null;
      const fallbackKey =
        data.type && (data.actionId || data.bookingId || data.conversationId)
          ? `${data.type}:${data.actionId || data.bookingId || data.conversationId}`
          : null;
      this.markRemotePushReceived(notifId, fallbackKey);
    });
    return () => {
      sub?.remove?.();
    };
  },

  startPushTokenRefreshListener(userId: string): () => void {
    if (Platform.OS === 'web' || !userId || !Notifications?.addPushTokenListener) {
      return () => {};
    }
    const sub = Notifications.addPushTokenListener(async (tokenObj: any) => {
      const rawToken = typeof tokenObj?.data === 'string' ? tokenObj.data.trim() : '';
      if (!rawToken) return;
      cachedDeviceToken = rawToken;
      AsyncStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, rawToken).catch(() => {});
      const appVersion = Constants.expoConfig?.version ?? null;
      try {
        await supabase.rpc('register_device_push_token', {
          p_push_token: rawToken,
          p_device_type: Platform.OS,
          p_app_version: appVersion,
        });
      } catch (err) {
        console.warn('[Push] Token rotation persistence note:', err);
      }
    });
    return () => {
      sub?.remove?.();
    };
  },

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
            dedupeKey: params.dedupeKey ?? null,
            metadata: metadataPayload,
            data: {
              type: params.type,
              actionType: params.actionType,
              actionId: params.actionId,
              conversationId: params.actionType === 'chat' ? params.actionId : undefined,
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

  async registerPushToken(userId: string): Promise<string | null> {
    if (Platform.OS === 'web' || !Notifications || !userId) return null;

    if (inFlightRegistration && inFlightRegistration.userId === userId) {
      return inFlightRegistration.promise;
    }

    const promise = (async (): Promise<string | null> => {
      try {
        try {
          const Device = require('expo-device');
          if (Device && Device.isDevice === false) {
            return null;
          }
        } catch {
          // expo-device optional
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return null;
        }

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

        const isExpoGo =
          Constants.appOwnership === 'expo' ||
          (Constants as any).executionEnvironment === 'storeClient';

        if (isExpoGo && Platform.OS === 'android') {
          return null;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants as any).easConfig?.projectId ??
          EAS_PROJECT_ID;

        let token: string | null = null;
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          token = tokenData?.data ?? null;
        } catch {
          try {
            const fallbackToken = await Notifications.getExpoPushTokenAsync();
            token = fallbackToken?.data ?? null;
          } catch {
            token = null;
          }
        }

        if (!token) return null;

        cachedDeviceToken = token;
        AsyncStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token).catch(() => {});

        const appVersion = Constants.expoConfig?.version ?? null;
        let saved = false;

        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('register_device_push_token', {
            p_push_token: token,
            p_device_type: Platform.OS,
            p_app_version: appVersion,
          });

          if (!rpcErr && (rpcData as any)?.success) {
            saved = true;
          } else if (rpcErr) {
            const { data: legacyRpc, error: legacyErr } = await supabase.rpc(
              'register_device_push_token',
              {
                p_push_token: token,
                p_device_type: Platform.OS,
              },
            );
            if (!legacyErr && (legacyRpc as any)?.success) {
              saved = true;
            }
          }
        } catch (rpcEx) {
          console.warn('[Push] register_device_push_token RPC call exception:', rpcEx);
        }

        if (!saved) {
          try {
            const { data: existingDevice } = await supabase
              .from('user_devices')
              .select('id')
              .eq('user_id', userId)
              .or(`push_token.eq.${token},device_token.eq.${token}`)
              .maybeSingle();

            if (existingDevice?.id) {
              await supabase
                .from('user_devices')
                .update({
                  is_active: true,
                  push_token: token,
                  device_token: token,
                  device_type: Platform.OS,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingDevice.id);
            } else {
              await supabase.from('user_devices').insert({
                user_id: userId,
                push_token: token,
                device_token: token,
                device_type: Platform.OS,
                is_active: true,
                updated_at: new Date().toISOString(),
              });
            }
          } catch (directErr) {
            console.warn('[Push] Direct device registration note:', directErr);
          }
        }

        return token;
      } catch (err: any) {
        console.warn('[Push] Error registering push token:', err?.message || err);
        return null;
      } finally {
        if (inFlightRegistration?.userId === userId) {
          inFlightRegistration = null;
        }
      }
    })();

    inFlightRegistration = { userId, promise };
    return promise;
  },

  async deactivatePushToken(userId: string): Promise<boolean> {
    try {
      if (!userId) return false;
      const currentToken =
        cachedDeviceToken || (await AsyncStorage.getItem(DEVICE_TOKEN_STORAGE_KEY).catch(() => null));

      if (currentToken) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('deactivate_device_push_token', {
          p_push_token: currentToken,
        });
        if (!rpcErr && (rpcData as any)?.success) {
          cachedDeviceToken = null;
          AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY).catch(() => {});
          return true;
        }

        const { error } = await supabase
          .from('user_devices')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .or(`push_token.eq.${currentToken},device_token.eq.${currentToken}`);

        cachedDeviceToken = null;
        AsyncStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY).catch(() => {});
        return !error;
      }

      return true;
    } catch (err) {
      console.warn('[Push] Error deactivating push token:', err);
      return false;
    }
  },

  async triggerTestPush(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!__DEV__) {
      return { success: false, error: 'Test push is restricted to development builds.' };
    }
    try {
      if (Notifications?.scheduleNotificationAsync) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus === 'granted') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'ZuruSasa Coastal Alert (Dev)',
              body: 'Test Push Notification: Heads-up banners, sound, and vibration are active.',
              sound: 'default',
              channelId: 'default',
              data: { type: 'test_push', userId, timestamp: new Date().toISOString() },
            },
            trigger: null,
          });
        }
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
