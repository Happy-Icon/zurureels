import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  supabase,
  type BookingRow,
  type ExperienceRow,
  type ReelRow,
} from '@/lib/supabase';

export function useReels() {
  return useQuery<ReelRow[]>({
    queryKey: ['reels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reels')
        .select(
          `*,
          experience:experiences(id, title, location, current_price, price_unit),
          host:profiles!reels_user_id_profiles_fkey(full_name, verification_status)`,
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data as unknown as ReelRow[]) ?? [];
    },
  });
}

export function useExperiences(category?: string | null) {
  return useQuery<ExperienceRow[]>({
    queryKey: ['experiences', category ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('experiences')
        .select(
          'id, title, description, location, current_price, price_unit, entity_name, category, availability_status, metadata',
        )
        .limit(50);
      if (category) {
        query = query.eq('category', category);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data as ExperienceRow[]) ?? [];
    },
  });
}

export function useMyBookings(userId: string | undefined) {
  return useQuery<BookingRow[]>({
    queryKey: ['bookings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          `*,
          experience:experiences(id, title, location, current_price, price_unit)`,
        )
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return (data as unknown as BookingRow[]) ?? [];
    },
  });
}

interface CreateBookingInput {
  userId: string;
  experienceId: string;
  reelId?: string | null;
  amount: number | null;
  guests: number;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const { error } = await supabase.from('bookings').insert({
        user_id: input.userId,
        experience_id: input.experienceId,
        reel_id: input.reelId ?? null,
        amount: input.amount,
        guests: input.guests,
        status: 'pending',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
