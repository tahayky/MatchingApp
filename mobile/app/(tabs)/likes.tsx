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
import apiClient from '@/services/apiClient';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 2 - 20;

// Interface for like profiles
interface LikeProfile {
  userId: string;
  name: string;
  photo?: string;
  age?: number;
  bio?: string;
  likedAt: string;
}

export default function LikesScreen() {
  const [likes, setLikes] = useState<LikeProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          fetchLikes();
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Refresh likes when screen gets focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchLikes();
      }
      return () => {};
    }, [isAuthenticated])
  );
  
  // Fetch likes from the API
  const fetchLikes = async () => {
    try {
      setLoading(true);
      
      console.log('Sending API request: Get Likes');
      
      try {
        // Use the new /matches/likes endpoint that returns profiles that liked the current user
        const response = await apiClient.get('/matches/likes');
        
        if (response.data.success && response.data.likes?.length > 0) {
          console.log(`${response.data.likes.length} likes successfully received`);
          
          // Use likes directly from API
          const formattedLikes: LikeProfile[] = response.data.likes.map((like: any) => ({
            userId: like.userId || like._id, // Handle if userId is sometimes _id from backend
            name: like.name,
            age: like.age,
            bio: like.bio,
            likedAt: like.likedAt,
            photo: like.photo
          }));
          
          setLikes(formattedLikes);
        } else {
          console.log('No likes found from API');
          setLikes([]);
        }
      } catch (apiError) {
        console.error("Could not access Likes API (normal, endpoint might not be working yet):", apiError);
        
        // Fallback: Try to get profiles (This fallback logic might be removed if /matches/likes is stable)
        console.log("Alternative: Trying to fetch profiles...");
        const profilesResponse = await apiClient.get('/profiles/discover'); // This path might need update if it was /api/users/profile/discover
        
        if (profilesResponse.data.success && profilesResponse.data.profiles?.length > 0) {
          console.log(`${profilesResponse.data.profiles.length} profiles received`);
          
          // Show first 2 profiles as "likes" for testing purposes
          const sampleProfiles = profilesResponse.data.profiles.slice(0, 2);
          
          const formattedLikes: LikeProfile[] = sampleProfiles.map((profile: any) => {
            const user = profile.user || {}; // Assuming profile object has a nested user object
            return {
              userId: profile._id, // Use profile._id as userId for these samples
              name: user.name || "Unknown",
              age: calculateAge(user.dateOfBirth || new Date().toISOString()),
              bio: profile.bio || '',
              likedAt: new Date().toISOString(), // Fake timestamp
              photo: profile.photos?.find((p: any) => p.isMain)?.url
            };
          });
          
          setLikes(formattedLikes);
        } else {
          console.log('Your profiles could not be found, showing empty list');
          setLikes([]);
        }
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
      setLikes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = (like: LikeProfile) => {
    Alert.alert(
      `Profile: ${like.name}`,
      `${like.name}, ${like.age}\n${like.bio || 'No bio available'}`,
      [
        { text: "View Profile", onPress: () => console.log("View Profile") },
        { 
          text: "Like Back", 
          onPress: async () => {
            try {
              // Send like action to the API
              console.log(`Sending like action for profile ID: ${like.userId}`);
              
              // Call Match Action API
              const response = await matchService.likeOrPassUser({
                targetUserId: like.userId,
                action: 'like'
              });
              
              console.log("Like action response:", response);
              
              // Check if this created a match
              if (response.success && response.match.isMatch) {
                // It's a match!
                Alert.alert(
                  "It's a Match!",
                  `You and ${like.name} liked each other!`,
                  [
                    { text: "Keep Browsing", style: "cancel" },
                    { text: "View Matches", onPress: () => console.log("Navigate to matches") }
                  ]
                );
                
                // Refresh the likes list to remove this like (since it's now a match)
                fetchLikes();
              } else {
                // Just a normal like (should never happen since these are people who already liked you)
                Alert.alert("Liked!", `You liked ${like.name}!`);
                fetchLikes();
              }
            } catch (error) {
              console.error("Error sending like action:", error);
              Alert.alert("Error", "Could not process your like. Please try again.");
            }
          },
          style: "default"
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const renderLikeItem = ({ item }: { item: LikeProfile }) => (
    <TouchableOpacity
      style={styles.likeItem}
      onPress={() => handleProfilePress(item)}
    >
      <Image 
        source={item.photo ? { uri: item.photo } : require('@/assets/images/react-logo.png')} 
        style={styles.likeImage} 
      />
      <ThemedView style={styles.likeInfo}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {item.name}, {item.age}
        </ThemedText>
        <ThemedText numberOfLines={1} style={styles.likedTime}>
          {formatDate(item.likedAt)}
        </ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  // Helper function to calculate age from date of birth
  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  // Helper to format date to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) {
      return "just now";
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderEmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <ThemedText type="title">No Likes Yet</ThemedText>
      <ThemedText style={styles.emptyText}>
        When someone likes your profile, they'll appear here.
      </ThemedText>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Likes You've Received</ThemedText>
      </ThemedView>
      
      {loading ? (
        <ThemedView style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" />
        </ThemedView>
      ) : !isAuthenticated ? (
        <ThemedView style={[styles.container, styles.centered]}>
          <ThemedText type="title">Please log in</ThemedText>
          <ThemedText>You need to authenticate to see likes</ThemedText>
        </ThemedView>
      ) : likes.length > 0 ? (
        <FlatList
          data={likes}
          renderItem={renderLikeItem}
          keyExtractor={item => item.userId} 
          numColumns={2}
          contentContainerStyle={styles.likesList}
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
  likesList: {
    padding: 10,
  },
  likeItem: {
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
  likeImage: {
    width: '100%',
    height: ITEM_WIDTH,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  likeInfo: {
    padding: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  likedTime: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
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
