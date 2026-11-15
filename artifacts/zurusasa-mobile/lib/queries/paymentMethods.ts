import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type SavedPaymentMethodType = 'mpesa' | 'card';

export interface UserPaymentMethodRow {
  id: string;
  user_id: string;
  method_type: SavedPaymentMethodType;
  label: string;
  phone_number: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const USER_PAYMENT_METHODS_QUERY_KEY = 'user-payment-methods';

export function useUserPaymentMethods(userId?: string | null) {
  return useQuery<UserPaymentMethodRow[]>({
    queryKey: [USER_PAYMENT_METHODS_QUERY_KEY, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_payment_methods')
        .select('id, user_id, method_type, label, phone_number, is_default, created_at, updated_at')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[PAYMENT_METHODS] fetch error:', error.message);
        return [];
      }
      return (data ?? []) as UserPaymentMethodRow[];
    },
    staleTime: 30_000,
  });
}

export function useSaveUserPaymentMethod(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      methodType: SavedPaymentMethodType;
      label?: string | null;
      phoneNumber?: string | null;
      setDefault?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('upsert_user_payment_method', {
        p_method_type: params.methodType,
        p_label: params.label ?? null,
        p_phone_number: params.phoneNumber ?? null,
        p_set_default: params.setDefault ?? true,
      });

      if (error) throw new Error(error.message);
      return data as UserPaymentMethodRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_PAYMENT_METHODS_QUERY_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USER_PAYMENT_METHODS_QUERY_KEY] });
    },
  });
}

export function useSetDefaultUserPaymentMethod(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (methodId: string) => {
      const { data, error } = await supabase.rpc('set_default_user_payment_method', {
        p_method_id: methodId,
      });
      if (error) throw new Error(error.message);
      return data as UserPaymentMethodRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_PAYMENT_METHODS_QUERY_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USER_PAYMENT_METHODS_QUERY_KEY] });
    },
  });
}

export function useDeleteUserPaymentMethod(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (methodId: string) => {
      const { data, error } = await supabase.rpc('delete_user_payment_method', {
        p_method_id: methodId,
      });
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USER_PAYMENT_METHODS_QUERY_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: [USER_PAYMENT_METHODS_QUERY_KEY] });
    },
  });
}
