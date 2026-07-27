import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type NotificationRow } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const [list, count] = await Promise.all([
        notificationService.fetchNotifications(user.id),
        notificationService.fetchUnreadCount(user.id),
      ]);
      setNotifications(list);
      setUnreadCount(count);
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
              setUnreadCount((c) => c + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as NotificationRow;
            setNotifications((prev) => {
              const next = prev.map((n) => (n.id === updated.id ? updated : n));
              setUnreadCount(next.filter((n) => !n.is_read).length);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string })?.id;
            if (deletedId) {
              setNotifications((prev) => {
                const next = prev.filter((n) => n.id !== deletedId);
                setUnreadCount(next.filter((n) => !n.is_read).length);
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

  const markAsRead = async (notificationId: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    await notificationService.markAsRead(notificationId);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    await notificationService.markAllAsRead(user.id);
  };

  const deleteNotification = async (notificationId: string) => {
    // Optimistic UI update
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === notificationId);
      if (target && !target.is_read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== notificationId);
    });

    await notificationService.deleteNotification(notificationId);
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
  };
}
