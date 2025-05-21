import { StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { CardDeck } from '@/components/CardDeck';
import { ProfileData } from '@/components/SwipeableCard';
import { profileService, matchService, authService } from '@/services';
import { mockProfiles } from '@/utils/mockData';

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Initial auth check - API connection re-enabled
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Auth check
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          // Fetch profiles from API (mock profiles as fallback)
          console.log('Authenticated, fetching profiles from API...');
          fetchProfiles();
          fetchMatches();
        } else {
          // If not logged in, directly close loading state
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        // Even on error, finish loading and use mock profiles
        setProfiles(mockProfiles); // Consider removing mock data if API is primary
        setLoading(false);
      }
    };

    // Initialize loading state
    setLoading(true);

    // Auth after a short delay
    const authTimeout = setTimeout(() => {
      console.log('Initiating authentication and profile loading');
      checkAuth();
    }, 1000);

    // Cleanup function
    return () => {
      clearTimeout(authTimeout);
    };
  }, []);

  // FOCUS HOOK FULLY DISABLED - To prevent infinite loading loop
  // useFocusEffect(
  //   useCallback(() => {
  //     // DISABLED - This hook will not run until the issue is resolved
  //     return () => {};
  //   }, [])
  // );

  // State to track profile fetch status
  const [fetchAttempted, setFetchAttempted] = useState<boolean>(false);

  // fetchProfiles that makes the actual API call
  const fetchProfiles = async (isRefetch = false) => { // Added isRefetch parameter
    if (loading && !isRefetch) { // Prevent new fetch if already loading, unless it's a specific refetch
      console.log('fetchProfiles: Already loading, skipping new fetch.');
      return;
    }
    try {
      console.log(`fetchProfiles called (isRefetch: ${isRefetch}) - Fetching profiles from backend`);
      setLoading(true);
      // setFetchAttempted(true); // We'll manage refetch differently

      // API request limit (max 5 seconds)
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), 5000);
      });

      // Sending API request
      console.log('Sending API request: discover profiles');
      const response = await Promise.race([
        profileService.discoverProfiles(),
        timeoutPromise
      ]) as any;

      // Examining API response
      console.log(`API response received! Success: ${response.success}`);

      if (response.success && response.profiles?.length > 0) {
        console.log(`Number of API profiles: ${response.profiles.length}`);

        // Printing first profile example
        console.log('First profile example:', JSON.stringify(response.profiles[0], null, 2));

        // Process profiles from API - set image part to correct format
        const formattedProfiles: ProfileData[] = response.profiles.map((profile: any) => {
          console.log(`Creating card for Profile ID: ${profile._id}`);

          // Photo check - more direct approach
          const defaultImage = require('@/assets/images/react-logo.png'); // Consider a more generic placeholder
          let profileImage = defaultImage;

          // If profile photo exists, use URI (must be ImageSourcePropType in require format)
          const mainPhoto = profile.photos?.find((photo: any) => photo.isMain);
          if (mainPhoto?.url) {
            profileImage = { uri: mainPhoto.url };
            console.log(`Photo URL for ${profile.name}: ${mainPhoto.url}`); // Use profile.name
          } else {
            console.log(`No photo for ${profile.name}, using default`); // Use profile.name
          }

          return {
            id: profile._id,
            name: profile.name || "Unnamed", // Use profile.name directly
            age: profile.age, // Use age directly from backend response
            image: profileImage,
            bio: profile.bio || 'No bio information',
            distance: profile.location?.city
              ? `${profile.location.city}, ${profile.location.country || ''}`
              : 'Location unknown'
          };
        });

        // Add shuffle operation
        const shuffledProfiles = [...formattedProfiles].sort(() => Math.random() - 0.5);
        // If it's a refetch (e.g. deck empty), we replace the profiles.
        // If it was an initial load or a different kind of load, one might append.
        // For simplicity now, always replace.
        setProfiles(shuffledProfiles);
        console.log(`${shuffledProfiles.length} profiles successfully loaded from API and shuffled`);
      } else {
        if (response.success && response.profiles?.length === 0) {
          console.log('No new profiles found from API.');
          // Don't clear existing profiles if it was a refetch that found nothing new
          // but do clear if it's an initial load that found nothing.
          if (!isRefetch || profiles.length === 0) { // Clear if initial load or if deck was already empty
            setProfiles([]);
          }
        } else if (!response.success) {
          console.log('API call to fetch profiles was not successful:', response.message || 'Unknown error');
          if (!isRefetch || profiles.length === 0) {
             setProfiles([]); // Clear on error for initial load
          }
        }
      }
    } catch (error) {
      console.log('API error:', error);
      // Use empty array on error
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // fetchMatches that tries to get matches from API
  const fetchMatches = async () => {
    console.log('fetchMatches called - Fetching matches from API...');
    try {
      // Race between API request and timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout')), 3000);
      });

      const response = await Promise.race([
        matchService.getMatches(),
        timeoutPromise
      ]) as any;

      if (response.success) {
        setMatches(response.matches || []);
        console.log(`${response.matches?.length || 0} matches successfully loaded from API`);
      } else {
        // Use empty array on failure
        setMatches([]);
      }
    } catch (error) {
      console.error('API error - could not fetch matches:', error);
      setMatches([]);
    }
  };

  // Swipe operations that send actual API requests to backend
  const handleSwipeLeft = async (profile: ProfileData) => {
    console.log(`Passing profile ${profile.name} - API request`);
    try {
      // Send API request
      await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'pass'
      });
    } catch (error) {
      console.log(`API error, action logged: ${error}`);
    }
  };

  const handleSwipeRight = async (profile: ProfileData) => {
    console.log(`Liking profile ${profile.name} - API request`);

    try {
      // Send API request
      const response = await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'like'
      });

      console.log(`Like API response:`, response);

      // Match check
      if (response.success && response.match.isMatch) {
        // Successful match
        console.log(`🎉 MATCH FORMED! You matched with ${profile.name}!`);

        // Match status alert
        Alert.alert(
          "It's a Match!",
          `You and ${profile.name} liked each other!`,
          [
            { text: "Keep Swiping", style: "cancel" },
            { text: "See Matches", onPress: () => console.log("Navigate to matches") } // Consider navigation
          ]
        );

        // Update match list
        fetchMatches();
      } else if (response.success) {
        // Successful like but no match yet
        console.log(`${profile.name} liked, but no match yet`);
      } else {
        // Failed API response - Like quota finished or other error
        console.log(`API response failed: ${response.message || 'Unknown error'}`);

        // Notify user that like quota is finished
        Alert.alert(
          "Like Quota Reached",
          response.message || "Your daily like quota is full. Upgrade to premium to like more cards or try again tomorrow.",
          [
            { text: "OK", style: "cancel" },
            {
              text: "Upgrade to Premium",
              onPress: () => {
                console.log("Redirecting to Subscription screen");
                // Add navigation code to subscription screen here
              }
            }
          ]
        );
      }
    } catch (error) {
      // Serious error - means this API request completely failed
      console.log(`Critical API error: ${error}`);
    }
  };

  const handleDeckEmpty = () => {
    console.log('handleDeckEmpty called.');
    if (!loading) { // Only fetch if not already loading
      console.log('Deck empty and not currently loading, fetching new profiles...');
      fetchProfiles(true); // Pass true to indicate it's a refetch due to empty deck
    } else {
      console.log('Deck empty, but already loading. Will not trigger another fetch.');
    }
  };

  // The calculateAge function is no longer needed here as age comes from backend
  // const calculateAge = (dob: string): number => { ... };

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
        <ThemedText type="title">Please Log In</ThemedText>
        <ThemedText style={styles.infoText}>
          You need to log in to your account to see matches.
        </ThemedText>
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
  },
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
