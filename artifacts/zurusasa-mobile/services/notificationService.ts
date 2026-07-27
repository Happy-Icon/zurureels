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
   * Create a new notification entry (DB + Push trigger if push_token exists)
   */
  async createNotification(params: CreateNotificationParams): Promise<NotificationRow | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: params.userId,
          type: params.type,
          title: params.title,
          message: params.message,
          image_url: params.imageUrl ?? null,
          action_type: params.actionType ?? null,
          action_id: params.actionId ?? null,
          metadata: params.metadata ?? {},
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Attempt sending Expo push notification if token exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_token, notifications_enabled')
        .eq('id', params.userId)
        .single();

      if (profile?.push_token && profile.notifications_enabled !== false) {
        this.sendPushNotification(profile.push_token, params.title, params.message, {
          actionType: params.actionType,
          actionId: params.actionId,
        });
      }

      return data as NotificationRow;
    } catch (err) {
      console.warn('Error creating notification:', err);
      return null;
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

      // Save token & device info to Supabase profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('metadata')
        .eq('id', userId)
        .single();

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
        }),
      });
    } catch (err) {
      console.warn('Error sending push notification via Expo:', err);
    }
  },
};
