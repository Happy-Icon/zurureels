import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { supabase, type NotificationRow } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';

export const GUEST_NOTIFICATION_TYPES = new Set([
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
  'payment_success',
  'refund_processed',
  'message',
  'review_reminder',
  'promotion',
  'wishlist_available',
]);

export const HOST_NOTIFICATION_TYPES = new Set([
  'booking_request',
  'booking_cancelled',
  'payout_completed',
  'verification',
  'listing_approved',
  'listing_rejected',
  'performance',
  'message',
]);

export function useNotifications(modeOverride?: 'guest' | 'host') {
  const queryClient = useQueryClient();
  const { user, viewMode } = useAuth();
  const activeMode = modeOverride || viewMode || 'guest';
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setTotalUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const [list, count] = await Promise.all([
        notificationService.fetchNotifications(user.id),
        notificationService.fetchUnreadCount(user.id),
      ]);
      setNotifications(list);
      setTotalUnreadCount(count);
    } catch (err) {
      console.warn('useNotifications fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();

    if (!user) return;

    // Create unique topic instance to avoid duplicate realtime callback registration
    const channelName = `notif_user_${user.id}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as NotificationRow;
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
            if (!newNotif.is_read) {
              setTotalUnreadCount((c) => c + 1);
            }

            // Immediately invalidate React Query caches when a booking notification arrives
            if (
              newNotif.action_type === 'booking' ||
              newNotif.type === 'booking_confirmed' ||
              newNotif.type === 'booking_cancelled' ||
              newNotif.type === 'payment_success' ||
              newNotif.type === 'refund_processed' ||
              newNotif.type === 'booking_request'
            ) {
              queryClient.invalidateQueries({ queryKey: ['bookings'] });
              queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
              queryClient.invalidateQueries({ queryKey: ['host-calendar-bookings'] });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as NotificationRow;
            setNotifications((prev) => {
              const next = prev.map((n) => (n.id === updated.id ? updated : n));
              setTotalUnreadCount(next.filter((n) => !n.is_read).length);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string })?.id;
            if (deletedId) {
              setNotifications((prev) => {
                const next = prev.filter((n) => n.id !== deletedId);
                setTotalUnreadCount(next.filter((n) => !n.is_read).length);
                return next;
              });
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  const allowedTypes = activeMode === 'host' ? HOST_NOTIFICATION_TYPES : GUEST_NOTIFICATION_TYPES;
  const filteredNotifications = useMemo(
    () => notifications.filter((n) => allowedTypes.has(n.type)),
    [notifications, allowedTypes],
  );

  const unreadCount = useMemo(
    () => filteredNotifications.filter((n) => !n.is_read).length,
    [filteredNotifications],
  );

  const guestUnreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read && GUEST_NOTIFICATION_TYPES.has(n.type)).length,
    [notifications],
  );

  const hostUnreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read && HOST_NOTIFICATION_TYPES.has(n.type)).length,
    [notifications],
  );

  const markAsRead = async (notificationId: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
    setTotalUnreadCount((c) => Math.max(0, c - 1));

    await notificationService.markAsRead(notificationId);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setTotalUnreadCount(0);

    await notificationService.markAllAsRead(user.id);
  };

  const deleteNotification = async (notificationId: string) => {
    // Optimistic UI update
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === notificationId);
      if (target && !target.is_read) {
        setTotalUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== notificationId);
    });

    await notificationService.deleteNotification(notificationId);
  };

  return {
    notifications: filteredNotifications,
    rawNotifications: notifications,
    unreadCount,
    totalUnreadCount,
    guestUnreadCount,
    hostUnreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
  };
}
