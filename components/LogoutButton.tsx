import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface LogoutButtonProps {
  label?: string;
  style?: any;
  showAlert?: boolean;
}

export function LogoutButton({
  label = 'Logout',
  style,
  showAlert = true,
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogout = async () => {
    if (showAlert) {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', onPress: () => {} },
          {
            text: 'Logout',
            onPress: async () => {
              await performLogout();
            },
            style: 'destructive',
          },
        ]
      );
    } else {
      await performLogout();
    }
  };

  const performLogout = async () => {
    setLoading(true);
    try {
      await logout();
      router.replace('/signin');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: colors.tint, opacity: loading ? 0.6 : 1 },
        style,
      ]}
      onPress={handleLogout}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.text}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
