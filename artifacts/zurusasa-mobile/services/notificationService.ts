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
    Notifications?.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.log('Notifications handler config note:', e);
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
      // Build insert payload without image_url column (fixes PGRST204)
      const insertPayload: Record<string, any> = {
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: {
          ...(params.metadata ?? {}),
          ...(params.imageUrl ? { image_url: params.imageUrl } : {}),
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
        console.warn('Notification DB insert warning:', error?.message || error);
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
        console.warn('Push delivery warning:', pushErr);
      });

      return (data as NotificationRow) ?? null;
    } catch (err) {
      console.warn('Error creating notification:', err);
      return null;
    }
  },

  /**
   * Send push notification to all registered devices for a user
   */
  async sendPushNotificationForUser(
    recipientId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    try {
      // 1. Check user notification settings
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token, notifications_enabled')
        .eq('id', recipientId)
        .maybeSingle();

      if (profile?.notifications_enabled === false) {
        console.log(`Push notification skipped: User ${recipientId} has notifications disabled.`);
        return;
      }

      // Collect distinct tokens for multi-device support
      const tokens = new Set<string>();
      if (profile?.push_token && typeof profile.push_token === 'string') {
        tokens.add(profile.push_token);
      }

      // 2. Query user_devices table for registered devices
      try {
        const { data: devices } = await supabase
          .from('user_devices')
          .select('push_token')
          .eq('user_id', recipientId);

        if (devices) {
          for (const d of devices) {
            if (d.push_token && typeof d.push_token === 'string') {
              tokens.add(d.push_token);
            }
          }
        }
      } catch (devErr) {
        // user_devices table optional check; ignore schema missing errors
      }

      if (tokens.size === 0) {
        return;
      }

      // 3. Send to all unique registered push tokens for this user
      for (const token of tokens) {
        if (!token || typeof token !== 'string') continue;
        await this.sendPushNotification(token, title, body, data);
      }
    } catch (err) {
      console.warn('Error sending push notification for user:', err);
    }
  },

  /**
   * Register push token for Expo notifications
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
        console.warn('Push notification permissions denied');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      // Save token to profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', userId)
        .maybeSingle();

      const currentMeta = (profile?.metadata ?? {}) as Record<string, unknown>;

      await supabase
        .from('profiles')
        .update({
          push_token: token,
          device_type: Platform.OS,
          notifications_enabled: true,
          metadata: {
            ...currentMeta,
            push_token: token,
            device_type: Platform.OS,
          },
        })
        .eq('id', userId);

      // Upsert into user_devices table if present
      try {
        await supabase.from('user_devices').upsert(
          {
            user_id: userId,
            push_token: token,
            device_type: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,push_token' },
        );
      } catch (e) {
        // Ignore if user_devices table missing
      }

      return token;
    } catch (err) {
      console.warn('Error registering push token:', err);
      return null;
    }
  },

  /**
   * Trigger push notification via Expo Push API
   */
  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
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
          badge: 1,
        }),
      });
    } catch (err) {
      console.warn('Error sending push notification via Expo:', err);
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
          console.warn('Local push scheduling note:', e);
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
      console.warn('Error triggering test push:', err);
      return {
        success: false,
        error: err?.message || 'Failed to trigger test push notification on device.',
      };
    }
  },
};
