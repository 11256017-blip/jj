import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getUserProfile, initializeUserProfile, updateUserAvatar, updateUserName } from '@/utils/firestoreUtils';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, getAuth, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface UserData {
  email: string;
  name: string;
  avatarUrl: string;
}

export default function SettingsScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editNameModalVisible, setEditNameModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [changeAvatarModalVisible, setChangeAvatarModalVisible] = useState(false);

  const [newName, setNewName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pickedImageUri, setPickedImageUri] = useState<string>('');
  const [pickedImageBase64, setPickedImageBase64] = useState<string | null>(null);

  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (user?.uid) {
      loadUserProfile();
    }
  }, [user?.uid]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      if (!user?.uid) return;

      const profile = await getUserProfile(user.uid);
      if (profile) {
        setUserData({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        });
      } else {
        try {
          const email = user.email || '';
          const displayName = user.displayName || (email ? email.split('@')[0] : 'User');
          await initializeUserProfile(user.uid, email, displayName);
          const newProfile = await getUserProfile(user.uid);
          if (newProfile) {
            setUserData({
              email: newProfile.email,
              name: newProfile.name,
              avatarUrl: newProfile.avatarUrl,
            });
            Alert.alert('Notice', 'User profile was missing in Firestore and has been created. You can edit your profile now.');
          } else {
            Alert.alert('Error', 'User profile not found in Firestore and could not be created.');
          }
        } catch (createError: any) {
          console.error('Error initializing user profile:', createError);
          Alert.alert('Error', 'Failed to create profile: ' + (createError?.message || createError));
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    setUpdating(true);
    try {
      if (!user?.uid) throw new Error('User not found');

      await updateUserName(user.uid, newName);
      setUserData((prev) => (prev ? { ...prev, name: newName } : null));
      setEditNameModalVisible(false);
      Alert.alert('Success', 'Name updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword === currentPassword) {
      if (Platform.OS === 'web') {
        // window.alert works on web when Alert.alert doesn't
        // eslint-disable-next-line no-alert
        alert('提示：新密碼不能與當前舊密碼相同，請重新輸入');
      } else {
        Alert.alert('提示', '新密碼不能與當前舊密碼相同，請重新輸入');
      }
      return;
    }

    setUpdating(true);
    try {
      if (!user?.email) throw new Error('User email not found');

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordModalVisible(false);
      Alert.alert('Success', 'Password changed successfully!');
    } catch (error: any) {
      const errorMessage = error.message.includes('auth/wrong-password')
        ? 'Current password is incorrect'
        : error.message;
      Alert.alert('Error', errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission required', 'Permission to access gallery is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled === true) return;
    const asset = result.assets[0];
    setPickedImageUri(asset.uri);
    setPickedImageBase64(asset.base64 || null);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#F4F6F8' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!userData) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#F4F6F8' }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Failed to load profile</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.tint }]}
          onPress={loadUserProfile}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#F4F6F8' }]} contentContainerStyle={styles.scrollContent}> 
      <View style={styles.content}>
        
        {/* Profile Header Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={[styles.avatarPlaceholder, { backgroundColor: colors.tint + '15' }]}
            onPress={() => {
              setPickedImageUri(userData.avatarUrl || '');
              setPickedImageBase64(null);
              setChangeAvatarModalVisible(true);
            }}
          >
            {userData.avatarUrl ? (
              <Image source={{ uri: userData.avatarUrl }} style={styles.avatar} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.tint }]}>
                {userData.name.charAt(0).toUpperCase()}
              </Text>
            )}
            <View style={styles.avatarEditOverlay}>
              <Text style={styles.avatarEditOverlayText}>Edit</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.nameText}>{userData.name}</Text>
          <Text style={[styles.emailText, { color: colors.tabIconDefault }]}>{userData.email}</Text>
        </View>

        {/* Settings Sections grouped into a beautiful card */}
        <View style={styles.sectionsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Settings</Text>

          {/* Full Name Item */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              setNewName(userData.name);
              setEditNameModalVisible(true);
            }}
          >
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Full Name</Text>
              <Text style={[styles.settingValue, { color: colors.tabIconDefault }]}>
                {userData.name}
              </Text>
            </View>
            <Text style={[styles.settingArrow, { color: colors.tabIconDefault }]}>›</Text>
          </TouchableOpacity>

          {/* Profile Picture Item */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              setPickedImageUri(userData.avatarUrl || '');
              setPickedImageBase64(null);
              setChangeAvatarModalVisible(true);
            }}
          >
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Profile Picture</Text>
              <Text style={[styles.settingValue, { color: colors.tabIconDefault }]}>
                Tap to select from phone gallery
              </Text>
            </View>
            <Text style={[styles.settingArrow, { color: colors.tabIconDefault }]}>›</Text>
          </TouchableOpacity>

          {/* Change Password Item */}
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomWidth: 0 }]}
            onPress={() => setChangePasswordModalVisible(true)}
          >
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Password</Text>
              <Text style={[styles.settingValue, { color: colors.tabIconDefault }]}>
                Update your account password
              </Text>
            </View>
            <Text style={[styles.settingArrow, { color: colors.tabIconDefault }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            try {
              const auth = getAuth();
              await signOut(auth);
              router.replace('/login');
            } catch (error: any) {
              console.error('Sign out failed:', error);
              Alert.alert('Error', 'Sign out failed: ' + (error?.message || String(error)));
            }
          }}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Name Modal */}
      <Modal visible={editNameModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: '#1A1A1A' }]}>Edit Name</Text>

            <TextInput
              style={[styles.modalInput, { borderColor: '#E9E9EB', color: '#1A1A1A' }]}
              placeholder="Enter your name"
              placeholderTextColor="#A1A1A1"
              value={newName}
              onChangeText={setNewName}
              editable={!updating}
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#F1F3F5' }]}
                onPress={() => setEditNameModalVisible(false)}
                disabled={updating}
              >
                <Text style={[styles.modalButtonText, { color: '#495057' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={handleUpdateName}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="white" /> : <Text style={styles.modalButtonTextPrimary}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={changePasswordModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: '#1A1A1A' }]}>Change Password</Text>

            <TextInput
              style={[styles.modalInput, { borderColor: '#E9E9EB', color: '#1A1A1A' }]}
              placeholder="Current Password"
              placeholderTextColor="#A1A1A1"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              editable={!updating}
            />

            <TextInput
              style={[styles.modalInput, { borderColor: '#E9E9EB', color: '#1A1A1A' }]}
              placeholder="New Password"
              placeholderTextColor="#A1A1A1"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              editable={!updating}
            />

            <TextInput
              style={[styles.modalInput, { borderColor: '#E9E9EB', color: '#1A1A1A' }]}
              placeholder="Confirm New Password"
              placeholderTextColor="#A1A1A1"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!updating}
            />

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#F1F3F5' }]}
                onPress={() => setChangePasswordModalVisible(false)}
                disabled={updating}
              >
                <Text style={[styles.modalButtonText, { color: '#495057' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={handleChangePassword}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="white" /> : <Text style={styles.modalButtonTextPrimary}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Avatar Modal (No URLs, direct gallery picker) */}
      <Modal visible={changeAvatarModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', alignItems: 'center' }]}>
            <Text style={[styles.modalTitle, { color: '#1A1A1A', alignSelf: 'flex-start' }]}>Upload Profile Photo</Text>
            <Text style={styles.modalDescription}>Choose a clean, beautiful photo from your phone's gallery</Text>

            <TouchableOpacity style={styles.avatarPreview} onPress={handlePickImage}>
              {pickedImageUri ? (
                <Image source={{ uri: pickedImageUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewPlaceholderText}>Tap to Select Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#F1F3F5' }]}
                onPress={() => setChangeAvatarModalVisible(false)}
                disabled={updating}
              >
                <Text style={[styles.modalButtonText, { color: '#495057' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.tint }]}
                onPress={async () => {
                  if (!pickedImageUri && !pickedImageBase64) {
                    Alert.alert('Error', 'Please select an image first');
                    return;
                  }

                  setUpdating(true);
                  try {
                    if (!user?.uid) throw new Error('User not found');

                    const avatarData = pickedImageBase64 ? `data:image/jpeg;base64,${pickedImageBase64}` : pickedImageUri;
                    await updateUserAvatar(user.uid, avatarData);
                    setUserData((prev) => (prev ? { ...prev, avatarUrl: avatarData } : null));
                    setPickedImageBase64(null);
                    setPickedImageUri('');
                    setChangeAvatarModalVisible(false);
                    Alert.alert('Success', 'Avatar updated successfully!');
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  } finally {
                    setUpdating(false);
                  }
                }}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="white" /> : <Text style={styles.modalButtonTextPrimary}>Save Photo</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 44,
    fontWeight: 'bold',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  avatarEditOverlayText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F6F8',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 13,
  },
  settingArrow: {
    fontSize: 22,
    fontWeight: '300',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#FFE0E0',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 24,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 15,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  avatarPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  previewImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  previewPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E9E9EB',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
  },
  previewPlaceholderText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
});