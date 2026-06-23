# 🔐 Firebase Integration - Quick Reference

## ✅ What Was Created

### Core Files
1. **[config/firebaseConfig.js](./config/firebaseConfig.js)** - Firebase initialization with Auth & Firestore
2. **[context/AuthContext.tsx](./context/AuthContext.tsx)** - Auth state management & provider
3. **[app/_layout.tsx](./app/_layout.tsx)** - Updated root layout with auth flow
4. **[app/signin.tsx](./app/signin.tsx)** - Sign in page component
5. **[app/signup.tsx](./app/signup.tsx)** - Sign up page component

### Tab Pages
6. **[app/(tabs)/settings.tsx](./app/(tabs)/settings.tsx)** - Settings page with profile management
7. **[app/(tabs)/explore.tsx](./app/(tabs)/explore.tsx)** - Search page to find and add friends
8. **[app/(tabs)/friends.tsx](./app/(tabs)/friends.tsx)** - Friends list page with message button
9. **[app/(tabs)/chats.tsx](./app/(tabs)/chats.tsx)** - Chat list with last message preview
10. **[app/chat-detail.tsx](./app/chat-detail.tsx)** - Chat room with real-time messaging

### Utilities & Components
11. **[utils/firestoreUtils.ts](./utils/firestoreUtils.ts)** - Firestore helper functions (with chat functions)
12. **[components/LogoutButton.tsx](./components/LogoutButton.tsx)** - Reusable logout button

## 🚀 Getting Started

### 1. Install Firebase
```bash
npm install firebase
```

### 2. Configure Firebase Credentials
Update [config/firebaseConfig.js](./config/firebaseConfig.js) with your Firebase project credentials from [Firebase Console](https://console.firebase.google.com/)

### 3. Enable Firebase Services
- **Authentication**: Enable Email/Password sign-in method
- **Firestore**: Create a database in test mode
- **Security Rules**: Apply the rules from [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

## 📱 How It Works

### Authentication Flow
```
App Launch
  ↓
AuthContext checks login state
  ↓
  ├─ Logged In → Show (tabs) home page
  └─ Not Logged In → Show signin/signup pages
```

### Firestore User Document
When a user signs up:
```json
{
  "email": "user@example.com",
  "uid": "userId",
  "name": "John Doe",
  "avatarUrl": "",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## 🎯 Using Auth Context

### In Your Components

```typescript
import { useAuth } from '@/context/AuthContext';

export default function MyComponent() {
  const { user, signIn, signUp, logout, loading } = useAuth();

  // user: Current Firebase User object (or null)
  // loading: true while checking auth state on app start
  
  return (
    <View>
      {user && <Text>Hello, {user.email}</Text>}
    </View>
  );
}
```

## 🛠️ Common Tasks

### Get User Profile
```typescript
import { getUserProfile } from '@/utils/firestoreUtils';

const profile = await getUserProfile(user.uid);
console.log(profile.name, profile.avatarUrl);
```

### Update User Profile
```typescript
import { updateUserProfile } from '@/utils/firestoreUtils';

await updateUserProfile(user.uid, {
  name: 'New Name',
  avatarUrl: 'https://...'
});
```

### Add Logout Button
```typescript
import { LogoutButton } from '@/components/LogoutButton';

<LogoutButton label="Sign Out" showAlert={true} />
```

## 🔐 Auth Functions

### Sign Up
```typescript
const { signUp } = useAuth();
await signUp('user@example.com', 'password123', 'John Doe');
```

### Sign In
```typescript
const { signIn } = useAuth();
await signIn('user@example.com', 'password123');
```

### Logout
```typescript
const { logout } = useAuth();
await logout();
```

## ⚙️ Settings Page Features

The Settings tab provides users with comprehensive profile management:

### 📋 View Profile
- Display current email, name, and avatar
- Avatar shows user initials if no URL is set

### ✏️ Edit Name
- Modal dialog for changing display name
- Updates Firestore `users` collection in real-time

### 🔐 Change Password
- Requires current password for security (reauthentication)
- Validates new password (minimum 6 characters)
- Ensures new and confirm passwords match
- Uses Firebase Auth's `updatePassword` API

### 🖼️ Change Avatar
- Input image URL via TextInput
- Validates URL format (must start with http:// or https://)
- Shows preview of image before updating
- Updates Firestore `avatarUrl` field

### 🚪 Logout
- One-tap logout with confirmation dialog
- Securely signs out user from Firebase Auth

## � Friend System Features

### 🔍 Search Page (Explore Tab)
- **Search Users** - Find friends by name or email
- **Real-time Search** - Results update as you type
- **Add Friend** - One-tap button to add users
- **Friend Status** - Shows "✓ Friends" if already connected
- **Avatar Preview** - Displays user avatars or initials

### Friend Search Functions
```typescript
import { searchUsers, addFriend, isFriend, getFriendsList, removeFriend } from '@/utils/firestoreUtils';

// Search for users
const results = await searchUsers('john');  // Search by name or email

// Add a friend
await addFriend(userId, friendId);

// Check if friends
const areFriends = await isFriend(userId, friendId);

// Get all friends
const friends = await getFriendsList(userId);

// Remove a friend
await removeFriend(userId, friendId);
```

### 👫 Friends List Page (Friends Tab)
- **Display All Friends** - Shows all your added friends in a FlatList
- **Friend Cards** - Each friend displays name, email, and avatar
- **Remove Friends** - Swipe or tap to remove friends with confirmation
- **Pull to Refresh** - Reload friends list
- **Friend Count** - Shows total number of friends

### Data Structure
Friends are stored in the user document:
```json
{
  "uid": "userId",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "friends": ["friendUid1", "friendUid2", "friendUid3"],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## � Chat System Features

### 📱 Chat List Page (Chats Tab)
- **Display All Chats** - Shows all active conversations
- **Last Message Preview** - Shows last message sent/received
- **Timestamp** - Displays time of last message (smart formatting: "now", "2m", "1h", "3d", etc.)
- **Sender Name** - Shows who sent the last message
- **Pull to Refresh** - Reload chat list
- **Unread Badge** - Red badge showing unread count (optional)
- **Sorted Chronologically** - Most recent chats first

### 💬 Chat Room Page (Chat Detail)
- **Message List** - Displays all messages in a chat with FlatList
- **Real-time Messages** - Uses Firestore `onSnapshot` listener for semi-instant updates
- **Message Bubbles** - Different colors for sent (blue) vs received (gray)
- **Sender Avatar** - Shows avatar with initials for each message (left for received, right for sent)
- **Sender Name** - Displays name of message author on received messages
- **Timestamps** - Shows precise time each message was sent (HH:MM format)
- **Message Input** - TextInput with Send button, disabled when empty
- **Keyboard Avoidance** - Uses `KeyboardAvoidingView` so input isn't hidden
- **Latest First** - Uses `FlatList` with `inverted={true}` to show newest messages at bottom
- **Server Timestamps** - Messages use `serverTimestamp()` for reliable ordering

### Chat Functions

#### One-time Fetch (for initial load or polling)
```typescript
import {
  createOrGetChat,
  getUserChats,
  getChatMessages,
  sendMessage,
  Chat,
  ChatListItem,
  Message,
} from '@/utils/firestoreUtils';

// Create or get existing chat with a friend
const chatId = await createOrGetChat(currentUserId, friendId);

// Get all chats for current user
const chats = await getUserChats(userId);

// Get all messages in a chat (one-time fetch)
const messages = await getChatMessages(chatId);

// Send a message with serverTimestamp
await sendMessage(chatId, userId, senderName, 'Hello!');
```

#### Real-time Listener (recommended)
```typescript
import { subscribeToMessages } from '@/utils/firestoreUtils';

// Subscribe to messages with real-time updates
const unsubscribe = subscribeToMessages(
  chatId,
  (messages) => {
    // Called whenever messages change
    setMessages(messages);
  },
  (error) => {
    // Handle errors
    console.error('Error loading messages:', error);
  }
);

// Clean up listener when component unmounts
useEffect(() => {
  return () => {
    unsubscribe();
  };
}, [chatId]);
```

The `subscribeToMessages` function:
- Uses Firestore `onSnapshot` for real-time updates
- Returns an unsubscribe function for cleanup
- Automatically handles connection state
- More efficient than polling
- Updates appear instantly when sent from any device

### Chat Data Structure

**Chats Collection:**
```json
{
  "id": "chatId123",
  "participants": ["userId1", "userId2"],
  "participantNames": ["John", "Jane"],
  "participantAvatars": {
    "userId1": "https://...",
    "userId2": "https://..."
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-16T14:45:00Z"
}
```

**Messages Subcollection (chats/{chatId}/messages):**
```json
{
  "id": "messageId123",
  "senderId": "userId1",
  "senderName": "John",
  "text": "Hello, how are you?",
  "timestamp": "2024-01-16T14:45:00Z"
}
```

### Message Flow
1. User taps "Message" button on a friend in Friends list
2. `createOrGetChat()` creates new chat or gets existing one
3. User is navigated to `chat-detail` page
4. Messages are loaded from Firestore (sorted by timestamp)
5. User types and sends message via TextInput
6. Message is saved to `chats/{chatId}/messages` subcollection
7. Chat list automatically updates with new message

## 📋 File Structure

```
config/
  └── firebaseConfig.js           # Firebase init
context/
  └── AuthContext.tsx             # Auth provider
components/
  ├── LogoutButton.tsx            # Logout button
  ├── external-link.tsx
  └── ...
utils/
  └── firestoreUtils.ts           # Firestore helpers (with chat functions)
app/
  ├── _layout.tsx                 # UPDATED: With auth flow
  ├── signin.tsx                  # Sign in page
  ├── signup.tsx                  # Sign up page
  ├── chat-detail.tsx             # NEW: Chat room page
  └── (tabs)/
      ├── index.tsx               # Home page
      ├── explore.tsx             # Search/find friends page
      ├── friends.tsx             # Friends list with message button
      ├── chats.tsx               # NEW: Chat list page
      ├── settings.tsx            # Settings page
      └── _layout.tsx             # UPDATED: With all tabs including chats
```

## 🐛 Troubleshooting

**"Module not found: firebase"**
- Run: `npm install firebase`

**Auth pages not showing**
- Ensure firebaseConfig.js has valid credentials
- Check Firebase Console authentication is enabled

**Can't create user in Firestore**
- Check Firestore security rules are applied
- Verify Firestore database exists

**App crashes on startup**
- Ensure AuthProvider wraps all components (it's in _layout.tsx)
- Check console for Firebase initialization errors

## 📚 Next Features to Add

- [ ] Password reset email
- [ ] Social login (Google, Apple)
- [ ] Profile picture upload to Firebase Storage
- [ ] User presence/activity tracking
- [ ] Email verification
- [ ] Two-factor authentication

## 🔗 Resources

- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Firestore Docs](https://firebase.google.com/docs/firestore)
- [React Navigation Auth Flow](https://reactnavigation.org/docs/auth-flow/)
- Full setup guide: [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)
