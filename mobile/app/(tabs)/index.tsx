import { StyleSheet, Alert, View, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
// import { useFocusEffect } from '@react-navigation/native'; // Keep commented if not immediately needed

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { CardDeck } from '@/components/CardDeck';
import { ProfileData as SwipeableCardProfileData } from '@/components/SwipeableCard'; // Renamed to avoid conflict
import { profileService, matchService, authService, DiscoverProfilesResponse } from '@/services'; // Added DiscoverProfilesResponse
import { mockProfiles } from '@/utils/mockData'; // Keep for fallback if desired, or remove

// Define a more specific type for profiles used in this screen, matching SwipeableCard's expectation
type ScreenProfileData = SwipeableCardProfileData;

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<ScreenProfileData[]>([]);
  const [matches, setMatches] = useState<any[]>([]); // Consider a specific Match type
  const [loading, setLoading] = useState<boolean>(false); // Initial false, true when fetching
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [allProfilesLoaded, setAllProfilesLoaded] = useState<boolean>(false);

  const fetchInitialData = async () => {
    console.log('fetchInitialData: Initiating authentication and profile loading');
    setLoading(true); // Set loading true at the start of initial data fetch
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        console.log('Authenticated, fetching initial profiles (page 1) and matches...');
        await fetchProfiles(false, 1); // Fetch page 1 explicitly
        await fetchMatches(); // Fetch matches after profiles or in parallel
      } else {
        console.log('Not authenticated, no data will be fetched.');
        setProfiles([]); // Clear profiles if not authenticated
        setMatches([]);
      }
    } catch (error) {
      console.error("Auth check or initial fetch failed:", error);
      // setProfiles(mockProfiles); // Fallback to mock data if API fails on initial load
    } finally {
      setLoading(false); // Ensure loading is set to false after all initial attempts
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);


  const fetchProfiles = async (isLoadMore = false, pageToFetch?: number) => {
    if (loading) { // Simplified: if already loading anything, don't start another profile fetch
      console.log(`fetchProfiles: Skipping fetch. Currently Loading.`);
      return;
    }
    if (isLoadMore && allProfilesLoaded) {
      console.log(`fetchProfiles: Skipping fetch. All profiles already loaded.`);
      return;
    }
    
    const targetPage = pageToFetch !== undefined ? pageToFetch : (isLoadMore ? currentPage : 1);
    console.log(`fetchProfiles called (isLoadMore: ${isLoadMore}, pageToFetch: ${targetPage}) - Fetching profiles from backend`);
    setLoading(true);

    try {
      const timeoutPromise = new Promise<DiscoverProfilesResponse>((_, reject) => { // Ensure timeout rejects with correct type or Error
        setTimeout(() => reject(new Error('API request timeout for discoverProfiles')), 7000); 
      });

      console.log(`Sending API request: discover profiles (Page: ${targetPage}, Limit: 5)`);
      const response = await Promise.race([
        profileService.discoverProfiles(targetPage, 5), 
        timeoutPromise
      ]);

      console.log(`API response received! Success: ${response.success}, Profiles: ${response.profiles?.length}`);
      if (response.pagination) {
        console.log(`Pagination: Current ${response.pagination.currentPage}, Total ${response.pagination.totalPages}`);
      }

      if (response.success && response.profiles) {
        const formattedProfiles: ScreenProfileData[] = response.profiles.map((profile: any) => {
          const defaultImage = require('@/assets/images/react-logo.png');
          let profileImage = defaultImage;
          const mainPhoto = profile.photos?.find((photo: any) => photo.isMain);
          if (mainPhoto?.url) {
            profileImage = { uri: mainPhoto.url };
          }
          // Calculate age if dateOfBirth is present
          let age;
          if (profile.user?.dateOfBirth) {
            const birthDate = new Date(profile.user.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          } else if (profile.age) { // Use age if directly provided by backend
            age = profile.age;
          }

          return {
            id: profile._id,
            name: profile.name || profile.user?.name || "Unnamed",
            age: age,
            image: profileImage,
            bio: profile.bio || 'No bio information',
            distance: profile.location?.city
              ? `${profile.location.city}, ${profile.location.country || ''}`
              : 'Location unknown'
          };
        });
        
        const shuffledNewProfiles = [...formattedProfiles].sort(() => Math.random() - 0.5);

        if (targetPage === 1 && !isLoadMore) { 
          setProfiles(shuffledNewProfiles);
        } else { 
          setProfiles(prevProfiles => {
            const existingIds = new Set(prevProfiles.map(p => p.id));
            const uniqueNewProfiles = shuffledNewProfiles.filter(p => !existingIds.has(p.id));
            return [...prevProfiles, ...uniqueNewProfiles];
          });
        }
        console.log(`${shuffledNewProfiles.length} profiles processed from API.`);

        if (response.pagination) {
          setCurrentPage(response.pagination.currentPage + 1); // Prepare for next page
          setTotalPages(response.pagination.totalPages);
          if (response.pagination.currentPage >= response.pagination.totalPages) {
            setAllProfilesLoaded(true);
            console.log('All profiles loaded.');
          } else {
            setAllProfilesLoaded(false);
          }
        } else {
          setAllProfilesLoaded(true); // Assume all loaded if no pagination info
           console.warn('Pagination info missing from discoverProfiles response. Assuming all loaded.');
        }

      } else {
        console.log('No new profiles found from API or API call failed:', response.message);
        if (targetPage === 1 && !isLoadMore) { 
          setProfiles([]);
        }
        if (response.success && response.profiles?.length === 0) {
            setAllProfilesLoaded(true); 
        }
      }
    } catch (error: any) {
      console.log('fetchProfiles API error:', error.message);
      if (error.response?.status === 429) {
        Alert.alert("Rate Limited", "You're swiping too fast! Try again in a moment.");
        setAllProfilesLoaded(true); // Stop trying to fetch if rate limited for now
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    console.log('fetchMatches called - Fetching matches from API...');
    try {
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout for matches')), 3000);
      });
      const response = await Promise.race([
        matchService.getMatches(),
        timeoutPromise
      ]) as any; 
      if (response.success) {
        setMatches(response.matches || []);
        console.log(`${response.matches?.length || 0} matches successfully loaded from API`);
      } else {
        setMatches([]);
      }
    } catch (error) {
      console.error('API error - could not fetch matches:', error);
      setMatches([]);
    }
  };

  const handleSwipeLeft = async (profile: ScreenProfileData) => {
    console.log(`Passing profile ${profile.name} - API request`);
    try {
      await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'pass'
      });
      setProfiles(prev => prev.filter(p => p.id !== profile.id)); // Remove from local state
    } catch (error) {
      console.log(`API error on pass: ${error}`);
    }
  };

  const handleSwipeRight = async (profile: ScreenProfileData) => {
    console.log(`Liking profile ${profile.name} - API request`);
    try {
      const response = await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'like'
      });
      console.log(`Like API response:`, response);
      if (response.success && response.match.isMatch) {
        console.log(`🎉 MATCH FORMED! You matched with ${profile.name}!`);
        Alert.alert("It's a Match!", `You and ${profile.name} liked each other!`,
          [{ text: "Keep Swiping", style: "cancel" }, { text: "See Matches", onPress: () => console.log("Navigate to matches") }]
        );
        fetchMatches();
      } else if (response.success) {
        console.log(`${profile.name} liked, but no match yet`);
      } else {
        console.log(`API response failed on like: ${response.message || 'Unknown error'}`);
        Alert.alert("Like Quota Reached", response.message || "Your daily like quota is full.",
          [{ text: "OK", style: "cancel" }, { text: "Upgrade to Premium", onPress: () => console.log("Redirect to Subscription")}]
        );
      }
    } catch (error) {
      console.log(`Critical API error on like: ${error}`);
    } finally {
      setProfiles(prev => prev.filter(p => p.id !== profile.id)); // Remove from local state regardless of like success
    }
  };

  const handleDeckEmpty = () => {
    console.log('handleDeckEmpty called.');
    if (!loading && !allProfilesLoaded) { 
      console.log('Deck empty, not loading, and not all profiles loaded. Fetching more...');
      fetchProfiles(true); // true indicates it's a "load more" scenario (will fetch currentPage)
    } else {
      if (loading) console.log('Deck empty, but already loading.');
      if (allProfilesLoaded) console.log('Deck empty, but all profiles already loaded.');
    }
  };

  if (!isAuthenticated && !loading) { // Show login prompt only if not authenticated and not in initial load
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="title">Please Log In</ThemedText>
        <ThemedText style={styles.infoText}>You need to log in to see profiles.</ThemedText>
      </ThemedView>
    );
  }
  
  // Show loader if loading is true, OR if not authenticated yet but initial auth check is running
  if (loading || (isAuthenticated === false && profiles.length === 0)) { 
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading profiles...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Find Your Match</ThemedText>
        <ThemedText>{matches.length} matches so far</ThemedText>
      </ThemedView>

      <CardDeck
        profiles={profiles}
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        onDeckEmpty={handleDeckEmpty}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    paddingTop: 60, // Adjust as needed for status bar, etc.
    paddingBottom: 20,
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // loader style removed as ActivityIndicator is used directly with text
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
