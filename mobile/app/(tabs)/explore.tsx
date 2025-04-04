import {
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { matchService, authService } from '@/services';
import { MatchProfile } from '@/services/matchService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 2 - 20;

export default function MatchesScreen() {
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          fetchMatches();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Refetch matches when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchMatches();
      }
      return () => {};
    }, [isAuthenticated])
  );
  
  const fetchMatches = async () => {
    try {
      setLoading(true);
      const response = await matchService.getMatches();
      if (response.success) {
        setMatches(response.matches || []);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = (match: MatchProfile) => {
    // In a real app, this would navigate to a chat or profile screen
    Alert.alert(
      `Chat with ${match.name}`,
      `This would open a chat with ${match.name}`,
      [{ text: "OK", onPress: () => console.log("OK Pressed") }]
    );
  };

  const renderMatchItem = ({ item }: { item: MatchProfile }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => handleProfilePress(item)}
    >
      <Image 
        source={item.photo ? { uri: item.photo } : require('@/assets/images/react-logo.png')} 
        style={styles.matchImage} 
      />
      <ThemedView style={styles.matchInfo}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.lastMessage}>
          {new Date(item.matchedAt).toLocaleDateString()}
        </ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  const renderEmptyMatches = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText type="title">No matches yet</ThemedText>
      <ThemedText>Swipe right on profiles you like to get matches</ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Your Matches</ThemedText>
      </ThemedView>
      
      {loading ? (
        <ThemedView style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" />
        </ThemedView>
      ) : !isAuthenticated ? (
        <ThemedView style={[styles.container, styles.centered]}>
          <ThemedText type="title">Please log in</ThemedText>
          <ThemedText>You need to authenticate to see matches</ThemedText>
        </ThemedView>
      ) : matches.length > 0 ? (
        <FlatList
          data={matches}
          renderItem={renderMatchItem}
          keyExtractor={item => item.matchId} 
          numColumns={2}
          contentContainerStyle={styles.matchesList}
        />
      ) : (
        renderEmptyMatches()
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
  matchesList: {
    padding: 10,
  },
  matchItem: {
    width: ITEM_WIDTH,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  matchImage: {
    width: '100%',
    height: ITEM_WIDTH,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  matchInfo: {
    padding: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  lastMessage: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  }
});
