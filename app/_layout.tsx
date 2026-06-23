import { auth } from '@/config/firebaseConfig';
import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Slot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth State:', currentUser ? 'Logged In' : 'Logged Out', 'Initializing:', false);
      setUser(currentUser);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log('Auth State:', user ? 'Logged In' : 'Logged Out', 'Initializing:', initializing);
    if (initializing) {
      return;
    }

    const inAuthGroup = segments[0] === '(tabs)';
    if (user && !inAuthGroup) {
      router.replace('/');
    } else if (!user && inAuthGroup) {
      router.replace('/login');
    }
  }, [user, initializing, segments, router]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Slot />
      </AuthGate>
    </AuthProvider>
  );
}
