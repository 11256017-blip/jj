import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const { signIn } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      const message = 'Please fill in all fields';
      setErrorMessage(message);
      Alert.alert('Login Error', message);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error: any) {
      const message = error?.message || String(error);
      setErrorMessage(message);
      Alert.alert('Login Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToRegister = () => {
    router.push('/register');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>Sign in to your account</Text>

        <TextInput
          style={[styles.input, { borderColor: colors.tabIconDefault, color: colors.text }]}
          placeholder="Email"
          placeholderTextColor={colors.tabIconDefault}
          value={email}
          onChangeText={(text) => setEmail(text.trim())}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={[styles.input, { borderColor: colors.tabIconDefault, color: colors.text }]}
          placeholder="Password"
          placeholderTextColor={colors.tabIconDefault}
          value={password}
          onChangeText={(text) => setPassword(text)}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint, opacity: loading ? 0.6 : 1 }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
        {errorMessage ? <Text style={{ color: 'red', marginTop: 10 }}>{errorMessage}</Text> : null}

        <View style={styles.signUpContainer}>
          <Text style={[styles.signUpText, { color: colors.text }]}>Don't have an account? </Text>
          <TouchableOpacity onPress={handleNavigateToRegister} disabled={loading}>
            <Text style={[styles.signUpLink, { color: colors.tint }]}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingVertical: 60, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, fontSize: 16 },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  signUpContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signUpText: { fontSize: 14 },
  signUpLink: { fontSize: 14, fontWeight: 'bold' },
});
