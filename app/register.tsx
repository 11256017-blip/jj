import { auth, db } from '@/config/firebaseConfig';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !name.trim()) {
      const message = 'Please fill in all fields';
      setErrorMessage(message);
      Alert.alert('Sign Up Error', message);
      return;
    }

    if (password !== confirmPassword) {
      const message = 'Passwords do not match';
      setErrorMessage(message);
      Alert.alert('Sign Up Error', message);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newUser = userCredential.user;

      // Create user document in Firestore and wait for it to complete
      try {
        await setDoc(doc(db, 'users', newUser.uid), {
          email: newUser.email,
          uid: newUser.uid,
          name,
          avatarUrl: '',
          friends: [],
          studentId: '',
          createdAt: new Date(),
        });
        console.log('User profile created successfully in Firestore');
      } catch (firestoreError: any) {
        console.error('Firestore write failed:', firestoreError);
        throw new Error('Failed to create user profile in Firestore: ' + (firestoreError?.message || firestoreError));
      }

      Alert.alert('Success', 'Account created. You will be redirected automatically.');
      router.replace('/(tabs)');
    } catch (error: any) {
      const message = error?.message || String(error);
      setErrorMessage(message);
      Alert.alert('Sign Up Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToLogin = () => {
    router.push('/login');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.tabIconDefault }]}>Join us today and start messaging</Text>

        <TextInput
          style={[styles.input, { borderColor: colors.tabIconDefault, color: colors.text }]}
          placeholder="Full Name"
          placeholderTextColor={colors.tabIconDefault}
          value={name}
          onChangeText={setName}
          editable={!loading}
        />

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
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TextInput
          style={[styles.input, { borderColor: colors.tabIconDefault, color: colors.text }]}
          placeholder="Confirm Password"
          placeholderTextColor={colors.tabIconDefault}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint, opacity: loading ? 0.6 : 1 }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Create Account</Text>}
        </TouchableOpacity>
        {errorMessage ? <Text style={{ color: 'red', marginTop: 10 }}>{errorMessage}</Text> : null}

        <View style={styles.signInContainer}>
          <Text style={[styles.signInText, { color: colors.text }]}>Already have an account? </Text>
          <TouchableOpacity onPress={handleNavigateToLogin} disabled={loading}>
            <Text style={[styles.signInLink, { color: colors.tint }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, fontSize: 16 },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  signInContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signInText: { fontSize: 14 },
  signInLink: { fontSize: 14, fontWeight: 'bold' },
});
