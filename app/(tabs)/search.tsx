import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addFriend, isFriend, searchUsers } from '@/utils/firestoreUtils';
import { useState } from 'react';
import {
		ActivityIndicator,
		Alert,
		FlatList,
		Image,
		StyleSheet,
		Text,
		TextInput,
		TouchableOpacity,
		View,
} from 'react-native';

interface SearchResult {
	uid: string;
	email: string;
	name: string;
	avatarUrl: string;
	isFriend?: boolean;
}

export default function SearchScreen() {
	const [searchTerm, setSearchTerm] = useState('');
	const [results, setResults] = useState<SearchResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
	const { user } = useAuth();
	const colorScheme = useColorScheme();
	const colors = Colors[colorScheme ?? 'light'];

	const handleSearch = async (term: string) => {
		setSearchTerm(term);

		if (!term.trim()) {
			setResults([]);
			return;
		}

		setLoading(true);
		try {
			const searchResults = await searchUsers(term);
      
			const filtered = searchResults.filter(result => result.uid !== user?.uid);
			const resultsWithFriendStatus = await Promise.all(
				filtered.map(async (result) => ({
					...result,
					isFriend: user?.uid ? await isFriend(user.uid, result.uid) : false,
				}))
			);

			setResults(resultsWithFriendStatus);
		} catch (error: any) {
			Alert.alert('Error', 'Failed to search users: ' + error.message);
		} finally {
			setLoading(false);
		}
	};

	const handleAddFriend = async (friendId: string) => {
		if (!user?.uid) {
			Alert.alert('Error', 'User not authenticated');
			return;
		}

		setAddingFriendId(friendId);
		try {
			await addFriend(user.uid, friendId);
			setResults(prev =>
				prev.map(result =>
					result.uid === friendId ? { ...result, isFriend: true } : result
				)
			);

			Alert.alert('Success', 'Friend added successfully!');
		} catch (error: any) {
			Alert.alert('Error', error.message);
		} finally {
			setAddingFriendId(null);
		}
	};

	const renderUserItem = ({ item }: { item: SearchResult }) => (
		<View style={[styles.userCard, { borderBottomColor: colors.tabIconDefault + '20' }]}>
			<View style={styles.userInfo}>
				<View
					style={[
						styles.avatarSmall,
						{ backgroundColor: colors.tabIconDefault + '20' },
					]}
				>
					{item.avatarUrl ? (
						<Image
							source={{ uri: item.avatarUrl }}
							style={styles.avatar}
						/>
					) : (
						<Text style={[styles.avatarText, { color: colors.tint }]}>
							{item.name.charAt(0).toUpperCase()}
						</Text>
					)}
				</View>

				<View style={styles.userDetails}>
					<Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
					<Text style={[styles.userEmail, { color: colors.tabIconDefault }]}> 
						{item.email}
					</Text>
				</View>
			</View>

			<TouchableOpacity
				style={[
					styles.addButton,
					{
						backgroundColor: item.isFriend
							? colors.tabIconDefault + '30'
							: colors.tint,
						opacity: addingFriendId === item.uid ? 0.6 : 1,
					},
				]}
				onPress={() => handleAddFriend(item.uid)}
				disabled={item.isFriend || addingFriendId === item.uid}
			>
				{addingFriendId === item.uid ? (
					<ActivityIndicator
						color={item.isFriend ? colors.tabIconDefault : 'white'}
						size="small"
					/>
				) : (
					<Text
						style={[
							styles.buttonText,
							{
								color: item.isFriend ? colors.tabIconDefault : 'white',
							},
						]}
					>
						{item.isFriend ? '✓ Friends' : 'Add'}
					</Text>
				)}
			</TouchableOpacity>
		</View>
	);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}> 
			<View style={styles.searchHeader}>
				<Text style={[styles.title, { color: colors.text }]}>Find Friends</Text>

				<TextInput
					style={[
						styles.searchInput,
						{ borderColor: colors.tabIconDefault, color: colors.text },
					]}
					placeholder="Search by name or email..."
					placeholderTextColor={colors.tabIconDefault}
					value={searchTerm}
					onChangeText={handleSearch}
				/>
			</View>

			{loading ? (
				<View style={styles.centerContainer}>
					<ActivityIndicator size="large" color={colors.tint} />
				</View>
			) : results.length === 0 && searchTerm.trim() ? (
				<View style={styles.centerContainer}>
					<Text style={[styles.noResultsText, { color: colors.tabIconDefault }]}>No users found</Text>
				</View>
			) : results.length === 0 ? (
				<View style={styles.centerContainer}>
					<Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>Start typing to search for users</Text>
				</View>
			) : (
				<FlatList
					data={results}
					keyExtractor={item => item.uid}
					renderItem={renderUserItem}
					contentContainerStyle={styles.listContent}
					scrollEnabled={true}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
	searchHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
	title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
	searchInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
	listContent: { paddingHorizontal: 16, paddingVertical: 8 },
	userCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
	userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
	avatarSmall: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
	avatar: { width: '100%', height: '100%' },
	avatarText: { fontSize: 18, fontWeight: 'bold' },
	userDetails: { flex: 1 },
	userName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
	userEmail: { fontSize: 12 },
	addButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, minWidth: 70, alignItems: 'center' },
	buttonText: { fontSize: 12, fontWeight: '600' },
	noResultsText: { fontSize: 16 },
	emptyText: { fontSize: 14, textAlign: 'center' },
});


