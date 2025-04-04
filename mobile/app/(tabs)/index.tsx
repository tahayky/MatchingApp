import { StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { CardDeck } from '@/components/CardDeck';
import { ProfileData } from '@/components/SwipeableCard';
import { profileService, matchService, authService } from '@/services';

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        if (authenticated) {
          fetchProfiles();
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
  
  // Refetch data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchProfiles();
        fetchMatches();
      }
      return () => {};
    }, [isAuthenticated])
  );

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await profileService.discoverProfiles();
      
      if (response.success && response.profiles?.length > 0) {
        // Transform API profile data to match our SwipeableCard component's format
        const formattedProfiles: ProfileData[] = response.profiles.map(profile => ({
          id: profile._id,
          name: profile.user.name,
          age: calculateAge(profile.user.dateOfBirth),
          // Use main photo if available, otherwise use a placeholder
          image: profile.photos?.find(photo => photo.isMain)?.url 
            ? { uri: profile.photos.find(photo => photo.isMain)!.url }
            : require('@/assets/images/react-logo.png'),
          bio: profile.bio || '',
          distance: profile.location?.city 
            ? `${profile.location.city}, ${profile.location.country || ''}`
            : 'Location unknown'
        }));
        
        setProfiles(formattedProfiles);
      } else {
        // If no profiles found, you might want to fallback to some default state
        setProfiles([]);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
      // Fallback to empty array on error
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMatches = async () => {
    try {
      const response = await matchService.getMatches();
      if (response.success) {
        setMatches(response.matches || []);
      }
    } catch (error) {
      console.error("Error fetching matches:", error);
    }
  };

  const handleSwipeLeft = async (profile: ProfileData) => {
    try {
      await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'pass'
      });
    } catch (error) {
      console.error(`Error passing on ${profile.name}:`, error);
    }
  };

  const handleSwipeRight = async (profile: ProfileData) => {
    try {
      const response = await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'like'
      });
      
      // If it's a match
      if (response.success && response.match.isMatch) {
        // Show match alert
        Alert.alert(
          "It's a Match!",
          `You and ${profile.name} liked each other.`,
          [
            { text: "Keep Swiping", style: "cancel" },
            { text: "See Matches", onPress: () => console.log("Navigate to matches") }
          ]
        );
        
        // Refresh matches
        fetchMatches();
      }
    } catch (error) {
      console.error(`Error liking ${profile.name}:`, error);
    }
  };

  const handleDeckEmpty = () => {
    // Fetch more profiles
    fetchProfiles();
  };
  
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

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="title">Please log in</ThemedText>
        <ThemedText>You need to authenticate to use the app</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Find Your Match</ThemedText>
        <ThemedText>{matches.length} matches so far</ThemedText>
      </ThemedView>
      
      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <CardDeck
          profiles={profiles}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onDeckEmpty={handleDeckEmpty}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
