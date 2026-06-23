import { db } from '@/config/firebaseConfig';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatListItem } from '@/utils/firestoreUtils';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ChatsScreen() {
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Subscribe to chats when the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) {
        setChats([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const chatsRef = collection(db, 'chats');
      
      // 💡 修正點：移除 orderBy 以免在沒有手動建立建立 Firebase 複合索引時發生錯誤，並防止過濾掉剛建立且無訊息的聊天室
      const chatsQuery = query(
        chatsRef,
        where('participants', 'array-contains', user.uid)
      );

      const unsubscribe = onSnapshot(
        chatsQuery,
        snapshot => {
          const list: ChatListItem[] = [];

          snapshot.docs.forEach(chatDoc => {
            const chatData: any = chatDoc.data();

            const otherUserId = Array.isArray(chatData.participants)
              ? chatData.participants.find((id: string) => id !== user.uid)
              : undefined;

            const otherIndex = Array.isArray(chatData.participants) && otherUserId
              ? chatData.participants.indexOf(otherUserId)
              : -1;

            const participantName = (chatData.participantNames && otherIndex >= 0)
              ? chatData.participantNames[otherIndex]
              : (otherUserId ? 'Friend' : 'Group');

            const participantAvatar = (chatData.participantAvatars && otherUserId)
              ? chatData.participantAvatars[otherUserId]
              : '';

            const lastMessage = chatData.lastMessage || '';
            const rawTime = chatData.lastMessageTime;
            const lastMessageTime = rawTime && typeof rawTime?.toDate === 'function'
              ? rawTime.toDate()
              : rawTime instanceof Date
                ? rawTime
                : undefined;

            list.push({
              chatId: chatDoc.id,
              participants: chatData.participants || [],
              participantName,
              participantAvatar,
              lastMessage,
              lastMessageTime,
              lastMessageSender: chatData.lastMessageSender || '',
              unreadCount: chatData.unreadCount || 0,
            });
          });

          // 💡 修正點：改由前端將聊天室列表進行排序（最新訊息排在最上面）
          list.sort((a, b) => {
            const timeA = a.lastMessageTime ? a.lastMessageTime.getTime() : 0;
            const timeB = b.lastMessageTime ? b.lastMessageTime.getTime() : 0;
            return timeB - timeA;
          });

          setChats(list);
          setLoading(false);
        },
        error => {
          console.error('Error subscribing to chats:', error);
          Alert.alert('Error', 'Failed to load chats: ' + error.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }, [user?.uid])
  );

  const onRefresh = () => {
    setRefreshing(false);
  };

  const formatTime = (date?: Date) => {
    if (!date) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString();
  };

  const handleChatPress = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const renderChatItem = ({ item }: { item: ChatListItem }) => (
    <TouchableOpacity
      style={[styles.chatCard, { borderBottomColor: '#F2F2F7' }]}
      onPress={() => handleChatPress(item.chatId)}
      activeOpacity={0.7}
    >
      <View style={styles.chatInfo}>
        <View style={[styles.avatar, { backgroundColor: colors.tint + '15' }]}>
          {item.participantAvatar ? (
            <Image source={{ uri: item.participantAvatar }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.tint }]}>
              {item.participantName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        <View style={styles.chatDetails}>
          <Text style={[styles.participantName, { color: '#1A1A1A' }]}>
            {item.participantName}
          </Text>
          <Text style={[styles.lastMessage, { color: '#8E8E93' }]} numberOfLines={1}>
            {item.lastMessageSender && (
              <Text style={{ fontWeight: '600' }}>
                {item.lastMessageSender === item.participantName ? '' : item.lastMessageSender + ': '}
              </Text>
            )}
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        {item.lastMessageTime && (
          <Text style={[styles.timestamp, { color: '#8E8E93' }]}>
            {formatTime(item.lastMessageTime)}
          </Text>
        )}
        {item.unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.tint }]}>
            <Text style={styles.unreadText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: '#F4F6F8' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#F4F6F8' }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: '#1A1A1A' }]}>Chats</Text>
      </View>

      {chats.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: '#8E8E93' }]}>No chats yet</Text>
          <Text style={[styles.emptySubtext, { color: '#8E8E93' }]}>
            Go to Friends to start a conversation
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={item => item.chatId}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  chatCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  chatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  chatDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 13,
    maxWidth: '90%',
  },
  rightSection: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  timestamp: {
    fontSize: 12,
    marginBottom: 6,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});