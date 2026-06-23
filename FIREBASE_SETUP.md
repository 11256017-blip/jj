# Firebase Integration Setup Guide

## Step 1: Install Firebase

Run this command in your project root:
```bash
npm install firebase
```

## Step 2: Configure Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Go to **Project Settings** → **General** tab
4. Scroll down to find your web app configuration
5. Copy the firebaseConfig object

Update [config/firebaseConfig.js](../config/firebaseConfig.js) with your credentials:
```javascript
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

## Step 3: Enable Firebase Auth

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication

## Step 4: Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Start in **Test mode** (for development)
4. Choose your region

## Step 5: Set Firestore Security Rules

Go to **Firestore Database** → **Rules** and set:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read and write their own user document
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

## Project Structure

```
├── config/
│   └── firebaseConfig.js          # Firebase initialization
├── context/
│   └── AuthContext.tsx            # Auth state & functions
├── app/
│   ├── _layout.tsx                # Root layout with auth flow
│   ├── signin.tsx                 # Sign in page
│   ├── signup.tsx                 # Sign up page
│   └── (tabs)/                    # Tab navigation (shown after login)
```

## Features Implemented

### 📝 Sign Up
- Create account with email, password, and name
- Automatic Firestore user document creation
- Stores: `email`, `uid`, `name`, `avatarUrl` (empty by default)
- Validation: password match, minimum 6 characters, valid email

### 🔐 Sign In
- Email and password authentication
- Persists login state across app restarts
- Automatic navigation to tabs after login

### 🔄 Auth Context
Provides these functions via `useAuth()` hook:
- `signUp(email, password, name)` - Create new account
- `signIn(email, password)` - Sign in
- `logout()` - Sign out
- `user` - Current logged-in user (Firebase User object)
- `loading` - Loading state during auth initialization

## Usage Example

```typescript
import { useAuth } from '@/context/AuthContext';

export default function MyComponent() {
  const { user, signIn, logout } = useAuth();

  return (
    <View>
      <Text>Welcome, {user?.email}</Text>
      <TouchableOpacity onPress={logout}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
```

## Navigation Flow

```
App Launch
    ↓
Check Authentication State
    ↓
    ├─ User Logged In → (tabs) Home
    └─ User Not Logged In → signin/signup
```

## Firestore User Document Example

After sign up, a user document is created:
```json
{
  "users": {
    "userId123": {
      "email": "user@example.com",
      "uid": "userId123",
      "name": "John Doe",
      "avatarUrl": "",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Next Steps (Optional)

1. **Add logout button** in your tab pages using `useAuth()` hook
2. **Profile page** to update user info and avatar
3. **Forgot password** functionality using `sendPasswordResetEmail()`
4. **Social login** (Google, Apple, etc.)
5. **User presence** and **activity tracking**

## Troubleshooting

### "useAuth must be used within an AuthProvider"
- Make sure your component is inside the AuthProvider hierarchy (it's in root _layout.tsx)

### Firebase initialization errors
- Verify firebaseConfig.js has correct credentials
- Check Firebase Console project settings

### CORS issues on web
- Update Firebase Console → Project Settings → Authorized domains to include your domain

### Firestore permission errors
- Check Firestore security rules match your database structure
- Ensure user is authenticated before accessing Firestore
