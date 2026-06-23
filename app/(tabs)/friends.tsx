import { db } from '@/config/firebaseConfig';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFriendsList, getUserProfile } from '@/utils/firestoreUtils';
import { useFocusEffect } from '@react-navigation/native';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Friend {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: Date;
}

export default function FriendsScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('');
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null); 
  const [activeFriendName, setActiveFriendName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage> | null>(null);
  const messageUnsubsRef = useRef<Record<string, () => void>>({});
  const lastReadRef = useRef<Record<string, Date>>({});
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // 💡 修正 1：主列表也要能即時更新上線狀態，我們在這裡監聽所有好友
  // (status listeners moved into loadFriends to avoid duplicate subscriptions)

  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadFriends();
      }
    }, [user?.uid])
  );

  // cleanup message listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(messageUnsubsRef.current).forEach(u => u && u());
      messageUnsubsRef.current = {};
    };
  }, []);

  // 💡 修正 2：補齊依賴陣列（Dependency Array），確保切換對話時正確綁定監聽
  useEffect(() => {
    if (!activeChatId || !isChatOpen || !user?.uid || !activeFriendId) {
      setMessages([]);
      setChatLoading(false);
      return;
    }

    setChatLoading(true);
    
    // 1. 監聽聊天訊息
    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(
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
        setChatLoading(false);

        if (loadedMessages.length > 0) {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      },
      error => {
        console.error('Chat subscription error:', error);
        setChatLoading(false);
      }
    );

    return () => {
      unsubscribeMessages();
    };
    // 💡 補上了 user?.uid 與 activeFriendId 進入依賴陣列中
  }, [activeChatId, isChatOpen, activeFriendId, user?.uid]);

  const loadFriends = async () => {
    try {
      if (!user?.uid) return;

      setLoading(true);

      // remove any existing per-friend message listeners
      Object.values(messageUnsubsRef.current).forEach(u => u && u());
      messageUnsubsRef.current = {};

      const friendsList = await getFriendsList(user.uid);

      // ensure each friend has avatarUrl; fetch missing profiles in parallel
      const friendsWithMeta = await Promise.all(
        friendsList.map(async f => {
          let avatarUrl = (f as any).avatarUrl;
          if (!avatarUrl) {
            try {
              const profile = await getUserProfile((f as any).uid);
              avatarUrl = profile?.avatarUrl || '';
            } catch (e) {
              avatarUrl = '';
            }
          }
          return { ...f, avatarUrl, lastMessage: '', timestamp: '', unreadCount: 0 };
        })
      );

      setFriends(friendsWithMeta);

      // also fetch current user's avatar once
      try {
        const myProfile = await getUserProfile(user.uid);
        setMyAvatarUrl(myProfile?.avatarUrl || '');
      } catch (e) {
        setMyAvatarUrl('');
      }

      // attach listeners for each friend: latest message + unread count using persisted lastRead
      for (const friend of friendsWithMeta) {
        const friendId = (friend as any).id || friend.uid;
        const chatId = [user.uid, friendId].sort().join('_');

        // store chatId on friend for quick comparisons
        setFriends(prev => prev.map(p => (p.uid === friend.uid ? { ...p, chatId } : p)));

        // load persisted lastRead from user's friend subdoc
        try {
          const friendDoc = await getDoc(doc(db, 'users', user.uid, 'friends', friendId));
          const data: any = friendDoc.exists() ? friendDoc.data() : null;
          const lastRead = data?.lastRead ? (data.lastRead.toDate ? data.lastRead.toDate() : data.lastRead instanceof Date ? data.lastRead : new Date(0)) : new Date(0);
          lastReadRef.current[chatId] = lastRead;
        } catch (e) {
          lastReadRef.current[chatId] = new Date(0);
        }

        // messages listener: compute last message + unread count since lastRead
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const recentQuery = query(messagesRef, orderBy('createdAt', 'desc'));

        const unsubMsg = onSnapshot(
          recentQuery,
          snapshot => {
            if (!snapshot.empty) {
              const newestDoc = snapshot.docs[0];
              const newestData: any = newestDoc.data();
              const newestAt = newestData.createdAt?.toDate ? newestData.createdAt.toDate() : newestData.createdAt instanceof Date ? newestData.createdAt : undefined;

              // count unread: messages from others after lastRead
              const lastRead = lastReadRef.current[chatId] || new Date(0);
              let unread = 0;
              snapshot.docs.forEach(docSnap => {
                const d: any = docSnap.data();
                const createdAt = d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt instanceof Date ? d.createdAt : undefined;
                if (!createdAt) return;
                if (d.senderId !== user?.uid && createdAt > lastRead) {
                  unread += 1;
                }
              });

              setFriends(prev =>
                prev.map(p =>
                  p.uid === friend.uid
                    ? { ...p, lastMessage: newestData.text || '', timestamp: formatTimestamp(newestAt), unreadCount: unread }
                    : p
                )
              );
            } else {
              setFriends(prev => prev.map(p => (p.uid === friend.uid ? { ...p, lastMessage: '', timestamp: '', unreadCount: 0 } : p)));
            }
          },
          error => {
            console.error('Last message listener error for', friendId, error);
          }
        );

        messageUnsubsRef.current[friendId] = unsubMsg;
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load friends: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFriends();
    } finally {
      setRefreshing(false);
    }
  };


  const handleStartChat = async (friendId: string, friendName: string) => {
    if (!user?.uid) return;
    try {
      const currentUserId = user.uid;
      const chatId = [currentUserId, friendId].sort().join('_');

      const currentUserName = user.displayName || user.email?.split('@')[0] || 'User';
      
      await setDoc(doc(db, 'chats', chatId), {
        participants: [currentUserId, friendId],
        participantNames: currentUserId < friendId ? [currentUserName, friendName] : [friendName, currentUserName],
      }, { merge: true });

      // 打開聊天室時，先不顯示在線狀態（功能已移除）
      const currentFriendData = friends.find(f => f.uid === friendId);
      // mark messages as seen: persist lastRead and update local cache
      const now = new Date();
      try {
        await updateDoc(doc(db, 'users', user.uid, 'friends', friendId), { lastRead: now });
      } catch (e) {
        // fallback if the friend subdoc doesn't exist yet
        try {
          await setDoc(doc(db, 'users', user.uid, 'friends', friendId), { lastRead: now }, { merge: true });
        } catch (err) {
          console.error('Failed to persist lastRead for', friendId, err);
        }
      }
      lastReadRef.current[chatId] = now;
      setFriends(prev => prev.map(p => (p.uid === friendId ? { ...p, unreadCount: 0 } : p)));
      // keep existing behavior: no online flag
      setActiveChatId(chatId);
      setActiveFriendId(friendId); 
      setActiveFriendName(friendName);
      setInputText('');
      setIsChatOpen(true);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to start chat: ' + error.message);
    }
  };

  const handleSendMessage = async () => {
    if (!activeChatId || !inputText.trim() || !user?.uid) return;

    setChatSending(true);
    try {
      const text = inputText.trim();
      const senderName = user?.displayName || user?.email?.split('@')[0] || 'User';
      const messagesRef = collection(db, 'chats', activeChatId, 'messages');

      setInputText(''); 

      await addDoc(messagesRef, {
        text,
        senderId: user.uid,
        senderName,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', activeChatId), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: senderName,
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send message:', error);
    } finally {
      setChatSending(false);
    }
  };

  const closeChat = async () => {
    // persist lastRead for the active friend so unread counts reset correctly
    try {
      if (user?.uid && activeChatId) {
        const activeFriend = friends.find(f => f.chatId === activeChatId);
        if (activeFriend) {
          const friendDocId = (activeFriend as any).id || activeFriend.uid;
          const now = new Date();
          try {
            await updateDoc(doc(db, 'users', user.uid, 'friends', friendDocId), { lastRead: now });
          } catch (e) {
            // fallback: create/merge the friend subdoc if it doesn't exist
            try {
              await setDoc(doc(db, 'users', user.uid, 'friends', friendDocId), { lastRead: now }, { merge: true });
            } catch (err) {
              console.error('Failed to persist lastRead on close:', err);
            }
          }

          // update local cache
          lastReadRef.current[activeChatId] = now;
          setFriends(prev => prev.map(p => (p.chatId === activeChatId ? { ...p, unreadCount: 0 } : p)));
        }
      }
    } catch (err) {
      console.error('Error while updating lastRead on closeChat:', err);
    }

    setIsChatOpen(false);
    setActiveChatId(null);
    setActiveFriendId(null); 
    setActiveFriendName('');
    setMessages([]);
    setInputText('');
  };

  const formatTime = (date?: Date) => {
    const value = date || new Date();
    return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimestamp = (date?: Date) => {
    if (!date) return '';
    const hour = date.getHours();
    const isAM = hour < 12;
    const prefix = isAM ? '上午' : '下午';
    const hh = ((hour + 11) % 12) + 1; // convert to 12-hour
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `${prefix} ${hh}:${mm}`;
  };

  const renderFriendItem = ({ item }: { item: Friend }) => {
    const initials = item.name
      .split(' ')
      .map(n => (n && n[0]) || '')
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <View style={styles.friendCard}>
        <TouchableOpacity
          onPress={() => {
            // open chat modal for this friend
            handleStartChat(item.uid, item.name);
          }}
          activeOpacity={0.8}
          style={styles.friendInfo}
        >
          {/* 💡 修正 3：讓大頭貼右下角自帶精緻的即時在線/離線小圓點點綴 */}
          <View style={{ position: 'relative' }}>
            <View style={[styles.avatar, { backgroundColor: colors.tint + '15', marginRight: 0 }]}> 
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.tint }]}>{initials || '??'}</Text>
              )}
            </View>
                {/* status indicator removed */}
          </View>

          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{item.name}</Text>
            <Text numberOfLines={1} style={styles.lastMessage}>{item.lastMessage || ''}</Text>
            <Text style={styles.friendEmail}>{item.email}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.buttonsContainer}>
          {item.timestamp ? (
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          ) : null}
          {item.unreadCount && item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount > 4 ? '4+' : item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

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
        <Text style={[styles.title, { color: '#1A1A1A' }]}>My Friends</Text>
        <Text style={[styles.count, { color: colors.tabIconDefault }]}> 
          {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
        </Text>
      </View>

      {friends.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>You haven't added any friends yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.tabIconDefault }]}>Go to Explore to find and add friends</Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={item => item.uid}
          renderItem={renderFriendItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Modern Pop-up Chat Interface */}
      <Modal visible={isChatOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeChat}>
        <View style={styles.modalOverlay}> 
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Header */}
            <View style={styles.modalHeader}> 
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {activeFriendName}
                </Text>
                
                {/* status removed */}
              </View>

              <TouchableOpacity onPress={closeChat} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Chat Body */}
            <View style={styles.modalContent}>
              {chatLoading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={colors.tint} />
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={item => item.id}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  renderItem={({ item }) => {
                    const isOwner = item.senderId === user?.uid;
                    // compute avatar/initials
                    const myName = user?.displayName || user?.email?.split('@')[0] || 'Me';
                    const myInitials = myName
                      .split(' ')
                      .map(n => (n && n[0]) || '')
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'Me';

                    const activeFriend = friends.find(f => f.uid === activeFriendId);
                    const theirName = activeFriend?.name || activeFriendName || item.senderName || 'Friend';
                    const theirInitial = (theirName && theirName.substring(0, 2).toUpperCase()) || 'F';

                    if (isOwner) {
                      return (
                        <View style={[styles.messageRow, styles.messageRowRight]}> 
                          <View style={[styles.myMessageContainer]}> 
                            <View style={[styles.bubbleRight]}> 
                              <Text style={[styles.messageText, { color: '#FFFFFF' }]}>{item.text}</Text>
                              <Text style={[styles.messageTime, { color: 'rgba(255,255,255,0.7)' }]}>{formatTime(item.createdAt)}</Text>
                            </View>
                            {myAvatarUrl ? (
                              <Image source={{ uri: myAvatarUrl }} style={[styles.miniAvatarImage, { marginLeft: 8 }]} />
                            ) : (
                              <View style={[styles.myMiniAvatar]}> 
                                <Text style={styles.miniAvatarText}>{myInitials}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    }

                    // their message
                    return (
                      <View style={[styles.messageRow, styles.messageRowLeft]}> 
                        <View style={styles.theirMessageContainer}>
                            {activeFriend?.avatarUrl ? (
                              <Image source={{ uri: activeFriend.avatarUrl }} style={[styles.miniAvatarImage, { marginRight: 8 }]} />
                            ) : (
                              <View style={[styles.theirMiniAvatar]}> 
                                <Text style={styles.theirMiniAvatarText}>{theirInitial}</Text>
                              </View>
                            )}
                          <View style={[styles.bubbleLeft]}> 
                            <Text style={styles.senderName}>{item.senderName}</Text>
                            <Text style={[styles.messageText, { color: '#1A1A1A' }]}>{item.text}</Text>
                            <Text style={[styles.messageTime, { color: '#9CA3AF' }]}>{formatTime(item.createdAt)}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                  contentContainerStyle={styles.messagesContainer}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: '#9CA3AF', textAlign: 'center' }]}>
                        No messages yet.
                      </Text>
                      <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 4 }}>
                        Say hello to start the conversation!
                      </Text>
                    </View>
                  }
                />
              )}
            </View>

            {/* Fixed Input layout wrapper */}
            <View style={styles.inputBar}> 
              <TextInput
                style={styles.inputBox}
                placeholder="Type a message..."
                placeholderTextColor="#9CA3AF"
                value={inputText}
                onChangeText={setInputText}
                editable={!chatSending}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: colors.tint, opacity: chatSending || !inputText.trim() ? 0.5 : 1 }]}
                onPress={handleSendMessage}
                disabled={chatSending || !inputText.trim()}
              >
                <Text style={styles.sendButtonText}>{chatSending ? '...' : '›'}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  count: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  friendCard: {
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
  friendInfo: {
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
  friendDetails: {
    flex: 1,
    marginLeft: 14, // 💡 調整讓出圓點寬度
    marginRight: 8,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
    color: '#1A1A1A',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 13,
    color: '#8E8E93',
  },
  buttonsContainer: {
    justifyContent: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 6,
    textAlign: 'right',
    paddingRight: 4,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#636366',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
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
  myMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  miniAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  myMiniAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#0084ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  theirMiniAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  theirMiniAvatarText: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  miniAvatarImage: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    resizeMode: 'cover',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
    marginLeft: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  bubbleLeft: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    maxWidth: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
    marginLeft: 8,
  },
  bubbleRight: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderTopRightRadius: 4,
    maxWidth: '75%',
    marginRight: 8,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  inputBox: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 15,
    backgroundColor: '#F2F2F7',
    color: '#1A1A1A',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 22,
    marginTop: -2,
  },
});