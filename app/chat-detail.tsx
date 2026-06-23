import { db } from '@/config/firebaseConfig';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocalSearchParams } from 'expo-router';
import {
    addDoc,
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: Date;
}

export default function ChatDetailScreen() {
  const { chatId } = useLocalSearchParams();
  const chatIdString = typeof chatId === 'string' ? chatId : '';
  const { user } = useAuth();
  const currentUserId = user?.uid;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);

  useEffect(() => {
    if (!chatIdString || !currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const messagesRef = collection(db, 'chats', chatIdString, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      snapshot => {
        const loadedMessages: ChatMessage[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            senderId: data.senderId || '',
            senderName: data.senderName || '',
            text: data.text || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt instanceof Date ? data.createdAt : undefined,
          };
        });

        setMessages(loadedMessages);
        setLoading(false);

        if (loadedMessages.length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      },
      error => {
        console.error('Chat messages listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatIdString, currentUserId]);

  const formatTime = (date?: Date) => {
    const value = date || new Date();
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !chatIdString || !currentUserId) {
      return;
    }

    setSending(true);

    try {
      const text = messageInput.trim();
      const senderName = user?.displayName || user?.email?.split('@')[0] || 'User';
      const messagesRef = collection(db, 'chats', chatIdString, 'messages');

      await addDoc(messagesRef, {
        text,
        senderId: currentUserId,
        senderName,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', chatIdString), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
      });

      setMessageInput('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send chat message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwner = item.senderId === currentUserId;
    return (
      <View style={[styles.messageRow, isOwner ? styles.messageRowRight : styles.messageRowLeft]}>
        <View style={[styles.messageBubble, isOwner ? styles.bubbleOwner : styles.bubbleOther, { backgroundColor: isOwner ? colors.tint : colors.tabIconDefault + '15' }]}
        >
          {!isOwner && (
            <Text style={[styles.senderName, { color: colors.tabIconDefault }]}>{item.senderName}</Text>
          )}
          <Text style={[styles.messageText, { color: isOwner ? 'white' : colors.text }]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: isOwner ? 'rgba(255,255,255,0.7)' : colors.tabIconDefault }]}> {formatTime(item.createdAt)} </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>No messages yet. Send the first message.</Text>
          </View>
        }
      />

      <View style={[styles.inputBar, { borderTopColor: colors.tabIconDefault + '20' }]}> 
        <TextInput
          style={[styles.input, { borderColor: colors.tabIconDefault + '30', color: colors.text }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.tabIconDefault}
          value={messageInput}
          onChangeText={setMessageInput}
          editable={!sending}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.tint, opacity: sending || !messageInput.trim() ? 0.5 : 1 }]}
          onPress={handleSendMessage}
          disabled={sending || !messageInput.trim()}
        >
          <Text style={styles.sendButtonText}>{sending ? 'Sending' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwner: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 14,
  },
  sendButton: {
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: '700',
  },
});
