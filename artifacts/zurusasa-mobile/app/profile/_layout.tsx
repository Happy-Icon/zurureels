import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function ProfileLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/auth" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
