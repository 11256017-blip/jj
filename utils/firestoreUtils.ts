import { db } from '@/config/firebaseConfig';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';

export interface UserProfile {
  email: string;
  uid: string;
  name: string;
  avatarUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
  friends?: string[];
  studentId?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Date;
}

export interface Chat {
  id: string;
  participants: string[];
  participantNames: string[];
  participantAvatars: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
  lastMessageTime?: Date;
  lastMessageSender?: string;
}

export interface ChatListItem {
  chatId: string;
  participants: string[];
  participantName: string;
  participantAvatar: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  lastMessageSender?: string;
  unreadCount: number;
}

/**
 * Get user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Update user profile in Firestore
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Update user avatar URL
 */
export async function updateUserAvatar(uid: string, avatarUrl: string): Promise<void> {
  try {
    await updateUserProfile(uid, { avatarUrl });
  } catch (error) {
    console.error('Error updating avatar:', error);
    throw error;
  }
}

/**
 * Update user display name
 */
export async function updateUserName(uid: string, name: string): Promise<void> {
  try {
    await updateUserProfile(uid, { name });
  } catch (error) {
    console.error('Error updating name:', error);
    throw error;
  }
}

/**
 * Initialize user profile if not exists
 */
export async function initializeUserProfile(uid: string, email: string, name: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      {
        email,
        uid,
        name,
        avatarUrl: '',
        friends: [],
        studentId: '',
        createdAt: new Date(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error initializing user profile:', error);
    throw error;
  }
}

/**
 * Search users by email or name
 */
export async function searchUsers(searchTerm: string): Promise<UserProfile[]> {
  try {
    if (!searchTerm.trim()) return [];

    const usersRef = collection(db, 'users');
    const searchLower = searchTerm.toLowerCase();
    
    // Get all users and filter by multiple fields (name, email, studentId)
    const allUsersSnap = await getDocs(usersRef);
    const allUsers = allUsersSnap.docs.map(doc => doc.data() as UserProfile);
    
    // Filter results by name, email, or studentId (case-insensitive, partial match)
    const results = allUsers.filter(user => {
      const nameLower = user.name?.toLowerCase() || '';
      const emailLower = user.email?.toLowerCase() || '';
      const studentIdLower = user.studentId?.toLowerCase() || '';
      
      return nameLower.includes(searchLower) ||
             emailLower.includes(searchLower) ||
             studentIdLower.includes(searchLower);
    });
    
    return results;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
}

/**
 * Add friend to user's friends list
 */
export async function addFriend(userId: string, friendId: string): Promise<void> {
  try {
    if (userId === friendId) {
      throw new Error('Cannot add yourself as a friend');
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const currentFriends = userSnap.data().friends || [];

    // Check if already friends
    if (currentFriends.includes(friendId)) {
      throw new Error('Already friends with this user');
    }

    // Add friend
    await updateDoc(userRef, {
      friends: [...currentFriends, friendId],
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error adding friend:', error);
    throw error;
  }
}

/**
 * Remove friend from user's friends list
 */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const currentFriends = userSnap.data().friends || [];
    const updatedFriends = currentFriends.filter((id: string) => id !== friendId);

    await updateDoc(userRef, {
      friends: updatedFriends,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
}

/**
 * Get all friends for a user with their profile information
 */
export async function getFriendsList(userId: string): Promise<UserProfile[]> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return [];
    }

    const friendIds = userSnap.data().friends || [];

    // Fetch friend profiles
    const friendProfiles: UserProfile[] = [];
    for (const friendId of friendIds) {
      try {
        const friendProfile = await getUserProfile(friendId);
        if (friendProfile) {
          friendProfiles.push(friendProfile);
        }
      } catch (error) {
        console.error(`Error fetching friend ${friendId}:`, error);
      }
    }

    return friendProfiles;
  } catch (error) {
    console.error('Error getting friends list:', error);
    throw error;
  }
}

/**
 * Check if two users are friends
 */
export async function isFriend(userId: string, friendId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return false;
    }

    const friends = userSnap.data().friends || [];
    return friends.includes(friendId);
  } catch (error) {
    console.error('Error checking friend status:', error);
    throw error;
  }
}

/**
 * Create or get a chat room between two users
 */
export async function createOrGetChat(userId: string, otherUserId: string): Promise<string> {
  try {
    if (userId === otherUserId) {
      throw new Error('Cannot create chat with yourself');
    }

    // Generate consistent chatId by sorting UIDs
    const sortedUids = [userId, otherUserId].sort();
    const chatId = `${sortedUids[0]}_${sortedUids[1]}`;

    // Check if chat already exists
    const chatRef = doc(db, 'chats', chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      // Chat already exists
      return chatId;
    }

    // Get both user profiles for participant names and avatars
    const userProfile = await getUserProfile(userId);
    const otherUserProfile = await getUserProfile(otherUserId);

    if (!userProfile || !otherUserProfile) {
      throw new Error('User profile not found');
    }

    // Create new chat with minimal required fields
    await setDoc(chatRef, {
      participants: [userId, otherUserId],
      participantNames: [userProfile.name, otherUserProfile.name],
      participantAvatars: {
        [userId]: userProfile.avatarUrl,
        [otherUserId]: otherUserProfile.avatarUrl,
      },
      lastMessage: '',
      lastMessageTime: null,
      lastMessageSender: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return chatId;
  } catch (error) {
    console.error('Error creating/getting chat:', error);
    throw error;
  }
}

/**
 * Get all chats for a user with latest message info
 */
export async function getUserChats(userId: string): Promise<ChatListItem[]> {
  try {
    const chatsRef = collection(db, 'chats');
    const chatsQuery = query(chatsRef, where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'));
    const chatsSnap = await getDocs(chatsQuery);

    const chatListItems: ChatListItem[] = [];

    for (const chatDoc of chatsSnap.docs) {
      const chatData = chatDoc.data() as Chat;
      const otherUserId = chatData.participants.find(id => id !== userId);
      if (!otherUserId) continue;

      const otherIndex = chatData.participants.indexOf(otherUserId);
      let participantName = chatData.participantNames?.[otherIndex] || '';
      let participantAvatar = chatData.participantAvatars?.[otherUserId] || '';

      if (!participantName) {
        const otherUserProfile = await getUserProfile(otherUserId);
        participantName = otherUserProfile?.name || 'Friend';
        participantAvatar = otherUserProfile?.avatarUrl || '';
      }

      const lastMessage = chatData.lastMessage || '';
      const lastMessageTime = chatData.lastMessageTime
        ? typeof (chatData.lastMessageTime as any)?.toDate === 'function'
          ? (chatData.lastMessageTime as any).toDate()
          : (chatData.lastMessageTime as Date)
        : undefined;
      const lastMessageSender = chatData.lastMessageSender || '';

      if (!lastMessage || !lastMessageTime) {
        continue;
      }

      chatListItems.push({
        chatId: chatDoc.id,
        participants: chatData.participants,
        participantName,
        participantAvatar,
        lastMessage,
        lastMessageTime,
        lastMessageSender,
        unreadCount: 0,
      });
    }

    return chatListItems;
  } catch (error) {
    console.error('Error getting user chats:', error);
    throw error;
  }
}

export function subscribeToUserChats(
  userId: string,
  onUpdate: (chats: ChatListItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const chatsRef = collection(db, 'chats');
  const chatsQuery = query(chatsRef, where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'));

  const unsubscribe = onSnapshot(
    chatsQuery,
    snapshot => {
      const chatListItems: ChatListItem[] = [];

      snapshot.docs.forEach(chatDoc => {
        const chatData = chatDoc.data() as Chat;
        const otherUserId = chatData.participants.find(id => id !== userId);
        if (!otherUserId) return;

        const otherIndex = chatData.participants.indexOf(otherUserId);
        const participantName = chatData.participantNames?.[otherIndex] || 'Friend';
        const participantAvatar = chatData.participantAvatars?.[otherUserId] || '';
        const lastMessage = chatData.lastMessage || '';
        const lastMessageTime = chatData.lastMessageTime
          ? typeof (chatData.lastMessageTime as any)?.toDate === 'function'
            ? (chatData.lastMessageTime as any).toDate()
            : (chatData.lastMessageTime as Date)
          : undefined;
        const lastMessageSender = chatData.lastMessageSender || '';

        if (!lastMessage || !lastMessageTime) return;

        chatListItems.push({
          chatId: chatDoc.id,
          participants: chatData.participants,
          participantName,
          participantAvatar,
          lastMessage,
          lastMessageTime,
          lastMessageSender,
          unreadCount: 0,
        });
      });

      onUpdate(chatListItems);
    },
    error => {
      console.error('Error subscribing to user chats:', error);
      onError?.(error as Error);
    }
  );

  return unsubscribe;
}

/**
 * Get all messages in a chat room (one-time fetch)
 */
export async function getChatMessages(chatId: string): Promise<Message[]> {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
    const messagesSnap = await getDocs(messagesQuery);

    return messagesSnap.docs.map(doc => ({
      id: doc.id,
      senderId: doc.data().senderId,
      senderName: doc.data().senderName,
      text: doc.data().text,
      timestamp: doc.data().timestamp?.toDate(),
    }));
  } catch (error) {
    console.error('Error getting chat messages:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time messages in a chat room using onSnapshot
 * Returns an unsubscribe function for cleanup
 */
export function subscribeToMessages(
  chatId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      snapshot => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          senderId: doc.data().senderId,
          senderName: doc.data().senderName,
          text: doc.data().text,
          createdAt: doc.data().createdAt?.toDate(),
        }));
        onUpdate(messages);
      },
      error => {
        console.error('Error subscribing to messages:', error);
        onError?.(error as Error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up message subscription:', error);
    throw error;
  }
}

/**
 * Send a message to a chat room
 */
export async function sendMessage(
  chatId: string,
  userId: string,
  senderName: string,
  messageText: string
): Promise<void> {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    const newMessage = {
      senderId: userId,
      senderName,
      text: messageText,
      createdAt: serverTimestamp(),
    };

    await addDoc(messagesRef, newMessage);

    // Update chat summary fields for the chat list
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: messageText,
      lastMessageTime: serverTimestamp(),
      lastMessageSender: senderName,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}
