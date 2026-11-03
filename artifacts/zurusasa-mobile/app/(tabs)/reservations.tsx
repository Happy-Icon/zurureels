import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { HostReservationsView } from '@/components/host/HostReservationsView';
import { GuestTripsView } from '@/components/reservations/GuestTripsView';

export default function ReservationsScreen() {
  const { viewMode } = useAuth();

  if (viewMode === 'host') {
    return <HostReservationsView />;
  }

  return <GuestTripsView />;
}
