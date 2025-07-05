import {
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';
import apiClient from '@/services/apiClient';

const { width } = Dimensions.get('window');

// Interface for message conversations
interface Conversation {
  id: string;
  participantName: string;
  participantPhoto?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          fetchConversations();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Refetch conversations when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchConversations();
      }
      return () => {};
    }, [isAuthenticated])
  );
  
  // Fetch conversations from the API
  const fetchConversations = async () => {
    try {
      setLoading(true);
      
      console.log('Sending API request: Get Matches (for conversations)');
      
      // Based on the backend code, there's no specific messages endpoint
      // Use the matches endpoint since matches are people you can message
      const response = await apiClient.get('/matches');
      
      if (response.data.success && response.data.matches?.length > 0) {
        console.log(`${response.data.matches.length} matches successfully received`);
        
        // Transform matches data to Conversation format
        const formattedConversations: Conversation[] = response.data.matches.map((match: any) => ({
          id: match.matchId || match._id, // Use match._id if matchId is not present
          participantName: match.targetUser?.name || "Unknown", // Assuming match object has targetUser with name
          participantPhoto: match.targetUser?.photo, // Assuming match object has targetUser with photo
          lastMessage: "You matched! Start a conversation.", // Default message for new matches
          lastMessageTime: match.matchedAt || new Date().toISOString(),
          unreadCount: 0 // No unread messages initially
        }));
        
        setConversations(formattedConversations);
      } else {
        console.log('No matches found from API');
        setConversations([]);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConversationPress = (conversation: Conversation) => {
    // In a real app, this would navigate to a chat screen
    Alert.alert(
      `Chat with ${conversation.participantName}`,
      `This would open a chat with ${conversation.participantName}`,
      [{ text: "OK", onPress: () => console.log("OK Pressed") }]
    );
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
    >
      <Image 
        source={item.participantPhoto ? { uri: item.participantPhoto } : require('@/assets/images/react-logo.png')} 
        style={styles.avatar} 
      />
      
      <ThemedView style={styles.conversationContent}>
        <ThemedView style={styles.conversationHeader}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>{item.participantName}</ThemedText>
          <ThemedText style={styles.timeText}>{formatMessageTime(item.lastMessageTime)}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.conversationFooter}>
          <ThemedText numberOfLines={1} style={styles.messagePreview}>
            {item.lastMessage}
          </ThemedText>
          
          {item.unreadCount > 0 && (
            <ThemedView style={styles.unreadBadge}>
              <ThemedText style={styles.unreadText}>{item.unreadCount}</ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </ThemedView>
    </TouchableOpacity>
  );

  // Format message time to readable format
  const formatMessageTime = (timeString: string) => {
    const messageDate = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - messageDate.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) {
      return "now";
    } else if (diffMin < 60) {
      return `${diffMin}m`;
    } else if (diffHour < 24) {
      return `${diffHour}h`;
    } else if (diffDay < 7) {
      return `${diffDay}d`;
    } else {
      return messageDate.toLocaleDateString();
    }
  };

  const renderEmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText type="title">No Messages Yet</ThemedText>
      <ThemedText style={styles.emptyText}>
        When you match with someone, you can start a conversation here.
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ThemedView style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" />
        </ThemedView>
      ) : !isAuthenticated ? (
        <ThemedView style={[styles.container, styles.centered]}>
          <ThemedText type="title">Please log in</ThemedText>
          <ThemedText>You need to authenticate to see messages</ThemedText>
        </ThemedView>
      ) : conversations.length > 0 ? (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.conversationsList}
        />
      ) : (
        renderEmptyState()
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationsList: {
    padding: 10,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 15,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreview: {
    flex: 1,
    color: '#777',
    fontSize: 14,
    marginRight: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  unreadBadge: {
    backgroundColor: '#2196F3',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7
  }
});
