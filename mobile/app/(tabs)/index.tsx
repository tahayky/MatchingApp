import { StyleSheet, Alert, View, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
// import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { CardDeck } from '@/components/CardDeck';
import { LikeQuotaDisplay } from '@/components/LikeQuotaDisplay';
import { ProfileData as SwipeableCardProfileData } from '@/components/SwipeableCard';
import { profileService, matchService, authService, DiscoverProfilesResponse } from '@/services';

// Create global event emitter for like events
(global as any).likeUsedEventEmitter = DeviceEventEmitter;

type ScreenProfileData = SwipeableCardProfileData;

const RETRY_DELAY_MS = 7000; // Yeniden denemeler arası bekleme süresi (ms), biraz artırdım

export default function HomeScreen() {
  const [profiles, setProfiles] = useState<ScreenProfileData[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [likeLoading, setLikeLoading] = useState<boolean>(false); // Like işlemi için loading
  const [processingProfileId, setProcessingProfileId] = useState<string | null>(null); // İşlem yapılan profil ID'si
  
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [allProfilesLoaded, setAllProfilesLoaded] = useState<boolean>(false);
  // retryCount state'i kaldırıldı, artık sonsuz deneyecek (uygulama kapanana kadar)

  const fetchInitialData = async () => {
    console.log('fetchInitialData: Initiating authentication and profile loading');
    setLoading(true); 
    try {
      const authenticated = await authService.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        console.log('Authenticated, fetching initial profiles (page 1) and matches...');
        await fetchProfiles(false, 1); 
        await fetchMatches(); 
      } else {
        console.log('Not authenticated, no data will be fetched.');
        setProfiles([]); 
        setMatches([]);
        setLoading(false); 
      }
    } catch (error) {
      console.error("Auth check or initial fetch failed:", error);
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchProfiles = async (isLoadMore = false, pageToFetch?: number) => {
    if (loading && !isLoadMore) { 
      console.log(`fetchProfiles: Skipping fetch. Currently Loading.`);
      return;
    }
    if (isLoadMore && allProfilesLoaded) {
      console.log(`fetchProfiles: Skipping fetch. All profiles already loaded.`);
      return;
    }
    
    // Backend skip kullanmadığı için her zaman sayfa 1 istiyoruz
    const targetPage = 1;
    console.log(`fetchProfiles called (isLoadMore: ${isLoadMore}, always requesting page: ${targetPage})`);
    setLoading(true);

    try {
      const timeoutPromise = new Promise<DiscoverProfilesResponse>((_, reject) => {
        setTimeout(() => reject(new Error('API request timeout for discoverProfiles')), 7000); 
      });

      const response = await Promise.race([
        profileService.discoverProfiles(targetPage), // limit parametresini kaldırdık, backend kendi ayarını kullansın
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
          if (mainPhoto?.url && mainPhoto.url.trim() !== '') {
            profileImage = { uri: mainPhoto.url };
          }
          let age;
          if (profile.user?.dateOfBirth) {
            const birthDate = new Date(profile.user.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
          } else if (profile.age) {
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
          // Backend skip kullanmadığı için pagination mantığı basitleşti
          console.log(`[PAGINATION] Total profiles available: ${response.pagination.totalProfiles}`);
          
          // Eğer profil gelmemişse, tüm profiller yüklenmiş demektir
          if (response.profiles.length === 0) {
            setAllProfilesLoaded(true);
            console.log('No more profiles returned by API - all profiles loaded.');
          } else {
            setAllProfilesLoaded(false);
          }
        } else {
          setAllProfilesLoaded(true); 
           console.warn('Pagination info missing from discoverProfiles response. Assuming all loaded.');
        }
        setLoading(false); 
      } else { 
        console.log('No new profiles found from API or API call failed:', response.message);
        if (targetPage === 1 && !isLoadMore) { 
          setProfiles([]);
        }
        if (response.success && response.profiles?.length === 0) {
            setAllProfilesLoaded(true); 
        }
        if (!response.success) {
            throw new Error(response.message || 'API call to fetch profiles was not successful');
        }
        setLoading(false); 
      }
    } catch (error: any) {
      console.log(`fetchProfiles API error (Page: ${targetPage}):`, error.message);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('Authentication/Authorization error. Stopping retries.');
        setIsAuthenticated(false); 
        setAllProfilesLoaded(true); // Daha fazla deneme yapma
        setLoading(false);
        // Kullanıcıya login olması gerektiğini belirten bir mesaj gösterilebilir veya login ekranına yönlendirilebilir.
        // Şimdilik Alert göstermiyoruz, sadece denemeyi durduruyoruz.
        return;
      }
      
      // Yeniden denenebilir hatalar (429, 5xx, ağ hatası) için sonsuz deneme
      const isRetryableError = error.response?.status === 429 || 
                               error.response?.status === 500 || 
                               error.response?.status === 503 || 
                               !error.response; // Ağ hatası (error.response tanımsız)
      
      if (isRetryableError) {
        console.log(`API request failed for page ${targetPage}. Retrying in ${RETRY_DELAY_MS / 1000}s... (Infinite retry)`);
        setTimeout(() => {
          // setLoading(true) bir sonraki fetchProfiles çağrısının başında yapılacak
          fetchProfiles(isLoadMore, targetPage); 
        }, RETRY_DELAY_MS);
        // setLoading(false) burada çağrılmamalı, çünkü yeniden deneme planlandı.
        return; 
      } else {
        // Diğer (yeniden denenemeyecek) HTTP hataları
        console.log('Non-retryable API error. Stopping further fetches for this page.');
        // Kullanıcıya hata göstermiyoruz, sadece denemeyi durduruyoruz.
        // Belki burada allProfilesLoaded true yapılabilir veya başka bir state ile UI'da bilgi verilebilir.
        // Şimdilik sadece denemeyi durdurup loading'i false yapalım.
        setAllProfilesLoaded(true); // Bu sayfa için daha fazla deneme yapma
      }
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
    setProfiles(prev => prev.filter(p => p.id !== profile.id));
    try {
      await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'pass'
      });
    } catch (error) {
      console.log(`API error on pass: ${error}`);
    }
  };

  const handleSwipeRight = async (profile: ScreenProfileData) => {
    console.log(`Liking profile ${profile.name} - API request`);
    
    // Çifte kontrol: hem genel loading hem de bu profil için işlem kontrolü
    if (likeLoading || processingProfileId === profile.id) {
      console.log('Like işlemi zaten devam ediyor, yeni işlem başlatılmıyor');
      return;
    }
    
    // Hemen işlem başlangıcını işaretle
    setLikeLoading(true);
    setProcessingProfileId(profile.id);
    try {
      const response = await matchService.likeOrPassUser({
        targetUserId: profile.id,
        action: 'like'
      });
      console.log(`Like API response:`, response);
      
      if (response.success && response.match.isMatch) {
        console.log(`🎉 MATCH FORMED! You matched with ${profile.name}!`);
        // Remove card only after successful API response
        setProfiles(prev => prev.filter(p => p.id !== profile.id));
        // Emit event to update quota display
        console.log('🚀 Emitting likeUsed event');
        DeviceEventEmitter.emit('likeUsed');
        Alert.alert("It's a Match!", `You and ${profile.name} liked each other!`,
          [{ text: "Keep Swiping", style: "cancel" }, { text: "See Matches", onPress: () => console.log("Navigate to matches") }]
        );
        fetchMatches();
      } else if (response.success) {
        console.log(`${profile.name} liked, but no match yet`);
        // Remove card only after successful API response
        setProfiles(prev => prev.filter(p => p.id !== profile.id));
        // Emit event to update quota display
        console.log('🚀 Emitting likeUsed event');
        DeviceEventEmitter.emit('likeUsed');
      } else {
        console.log(`API response failed on like: ${response.message || 'Unknown error'}`);
        
        // Handle "Another like operation is in progress" silently
        if (response.message && response.message.includes('Another like operation is in progress')) {
          console.log('Like operation already in progress, ignoring silently');
          // Reset states and return
          setLikeLoading(false);
          setProcessingProfileId(null);
          return; // Don't show alert or remove card
        }
        
        Alert.alert("Like Quota Reached", response.message || "Your daily like quota is full.",
          [{ text: "OK", style: "cancel" }, { text: "Upgrade to Premium", onPress: () => console.log("Redirect to Subscription")}]
        );
      }
    } catch (error) {
      console.log(`Critical API error on like: ${error}`);
    } finally {
      setLikeLoading(false);
      setProcessingProfileId(null);
    }
  };

  const handleDeckEmpty = () => {
    console.log('handleDeckEmpty called.');
    if (!loading && !allProfilesLoaded) { 
      console.log('Deck empty, not loading, and not all profiles loaded. Fetching more...');
      fetchProfiles(true); 
    } else {
      if (loading) console.log('Deck empty, but already loading.');
      if (allProfilesLoaded) console.log('Deck empty, but all profiles already loaded.');
    }
  };
  
  const initialLoadingCheck = !isAuthenticated && loading;

  if (initialLoadingCheck) { 
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading profiles...</ThemedText>
      </ThemedView>
    );
  }

  if (!isAuthenticated) { 
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="title">Please Log In</ThemedText>
        <ThemedText style={styles.infoText}>You need to log in to see profiles.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Find Your Match</ThemedText>
        <ThemedText>{matches.length} matches so far</ThemedText>
      </ThemedView>
      
      {/* Ana content alanı */}
      <ThemedView style={styles.mainContent}>
        {profiles.length === 0 && !loading && allProfilesLoaded && (
           <ThemedView style={[styles.container, styles.centered]}>
              <ThemedText type="subtitle">No more profiles to show.</ThemedText>
              <ThemedText>Check back later!</ThemedText>
           </ThemedView>
        )}
        {profiles.length === 0 && loading && (
           <ThemedView style={[styles.container, styles.centered]}>
              <ActivityIndicator size="large" />
              <ThemedText>Loading profiles...</ThemedText>
           </ThemedView>
        )}

        {profiles.length > 0 && (
          <CardDeck
            profiles={profiles}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onDeckEmpty={handleDeckEmpty}
            likeLoading={likeLoading}
          />
        )}
        
        {/* Floating overlay kalpler - kartların üzerinde */}
        <ThemedView style={styles.quotaOverlay}>
          <LikeQuotaDisplay />
        </ThemedView>
      </ThemedView>
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
  infoText: {
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  quotaOverlay: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    zIndex: 10,
    pointerEvents: 'none', // Kalplere dokunulmasın, kartlara odaklanılsın
  }
});
