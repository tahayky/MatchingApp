import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService, profileService, subscriptionService } from '@/services';
import apiClient, { setUseDeviceUrl, setCustomDeviceUrl } from '@/services/apiClient';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('FREE');

  const [authenticated, setAuthenticated] = useState<boolean>(false);

  // Initial authentication check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authService.isAuthenticated();
        setAuthenticated(isAuth);
        
        if (isAuth) {
          // Load data only if logged in
          loadUserData();
        } else {
          // Close loading state if not logged in
          setLoading(false);
        }
      } catch (error) {
        console.log('Authentication check error (silent)');
        setAuthenticated(false);
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Reload data when screen is focused and authenticated
  useFocusEffect(
    React.useCallback(() => {
      if (authenticated) {
        loadUserData();
      }
      return () => {}; // Cleanup function (optional)
    }, [authenticated])
  );

  const loadUserData = async () => {
    // Security check - only make API requests if authenticated
    if (!authenticated) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Get user data
      const userResponse = await authService.getCurrentUser();
      if (userResponse.success) {
        setUser(userResponse.user);
      }
      
      // Get profile data
      try {
        const profileResponse = await profileService.getMyProfile();
        if (profileResponse.success) {
          setProfile(profileResponse.profile);
        }
      } catch (error) {
        // Profile might not exist yet, that's ok
        console.log('Profile not found, may need to be created (silent)');
      }
      
      // Get subscription data
      try {
        const subscriptionResponse = await subscriptionService.getSubscriptionStatus();
        if (subscriptionResponse.success && subscriptionResponse.subscription) {
          setSubscriptionTier(subscriptionResponse.subscription.tier);
          setQuotaInfo(subscriptionResponse.subscription.quotaInfo);
        }
        
        // Get the most current quota info
        const quotaResponse = await subscriptionService.getLikeQuota();
        if (quotaResponse.success && quotaResponse.quotaInfo) {
          setQuotaInfo(quotaResponse.quotaInfo);
        }
      } catch (error) {
        console.log('Could not retrieve subscription info (silent)');
      }
    } catch (error) {
      console.log('User data loading error (silent)');
      // Do not show error message to client, just internal logging
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      router.replace('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>My Profile</ThemedText>
          <TouchableOpacity
            style={styles.settingsIcon}
            onPress={() => router.push('/profile/settings')}
          >
            <Ionicons name="settings-outline" size={28} color="#2196F3" />
          </TouchableOpacity>
        </ThemedView>
        
        <ThemedView style={styles.profileCard}>
          <ThemedView style={styles.profileHeader}>
            <Image
              source={
                (() => {
                  const mainPhoto = profile?.photos?.find((p: any) => p.isMain);
                  if (!mainPhoto) return require('@/assets/images/react-logo.png');
                  
                  // Use self-view URL if available and not expired, otherwise use cached URL
                  const imageUrl = mainPhoto.selfViewUrl &&
                    mainPhoto.selfViewUrlExpiration &&
                    new Date(mainPhoto.selfViewUrlExpiration) > new Date()
                      ? mainPhoto.selfViewUrl
                      : mainPhoto.url;
                  
                  return imageUrl ? { uri: imageUrl } : require('@/assets/images/react-logo.png');
                })()
              }
              style={styles.profileImage}
            />
            <ThemedView style={styles.profileInfo}>
              <ThemedText type="title">{user?.name || 'No Name'}</ThemedText>
              <ThemedText>{user?.email}</ThemedText>
              {profile?.bio && (
                <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
              )}
            </ThemedView>
          </ThemedView>
          
          {/* Subscription Info Card */}
          <ThemedView style={styles.subscriptionCard}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Subscription Status</ThemedText>
            <ThemedView style={styles.detailRow}>
              <ThemedText style={styles.detailLabel}>Plan:</ThemedText>
              <ThemedView style={[
                styles.tierBadge,
                subscriptionTier.toUpperCase() === 'PREMIUM' ? styles.premiumBadge :
                subscriptionTier.toUpperCase() === 'PLUS' ? styles.plusBadge : styles.freeBadge
              ]}>
                <ThemedText style={styles.tierText}>{subscriptionTier}</ThemedText>
              </ThemedView>
            </ThemedView>
            
            {quotaInfo && (
              <ThemedView>
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Likes:</ThemedText>
                  <ThemedText>{quotaInfo.remaining} / {quotaInfo.total}</ThemedText>
                </ThemedView>
                
                <ThemedView style={styles.quotaBarContainer}>
                  <ThemedView
                    style={[
                      styles.quotaBar,
                      {
                        width: `${quotaInfo.total > 0 ? (quotaInfo.remaining / quotaInfo.total) * 100 : 0}%`, // Avoid division by zero
                        backgroundColor: quotaInfo.total > 0 && quotaInfo.remaining > quotaInfo.total / 2 ? '#4CAF50' :
                                        quotaInfo.total > 0 && quotaInfo.remaining > quotaInfo.total / 5 ? '#FFC107' : '#F44336'
                      }
                    ]}
                  />
                </ThemedView>
                
                <ThemedText style={styles.quotaReset}>
                  Resets in: {subscriptionService.formatTimeUntilReset(quotaInfo)}
                </ThemedText>
              </ThemedView>
            )}
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.subscriptionButton,
                { backgroundColor: subscriptionTier.toUpperCase() === 'FREE' ? '#673AB7' : '#2196F3' }
              ]}
              onPress={() => router.push('/profile/subscription')}
            >
              <ThemedText style={styles.buttonText}>
                {subscriptionTier.toUpperCase() === 'FREE' ? 'Upgrade to Premium' : 'Manage Subscription'}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          {profile && (
            <ThemedView style={styles.detailsCard}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Profile Details</ThemedText>
              
              {profile.location?.city && (
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Location:</ThemedText>
                  <ThemedText>{`${profile.location.city}, ${profile.location.country || ''}`}</ThemedText>
                </ThemedView>
              )}
              
              {profile.occupation && (
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Occupation:</ThemedText>
                  <ThemedText>{profile.occupation}</ThemedText>
                </ThemedView>
              )}
              
              {profile.education && (
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Education:</ThemedText>
                  <ThemedText>{profile.education}</ThemedText>
                </ThemedView>
              )}
              
              {profile.interests && profile.interests.length > 0 && (
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Interests:</ThemedText>
                  <ThemedView style={styles.interestsContainer}>
                    {profile.interests.map((interest: string, index: number) => (
                      <ThemedView key={index} style={styles.interestBadge}>
                        <ThemedText style={styles.interestText}>{interest}</ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                </ThemedView>
              )}
            </ThemedView>
          )}
          
          {/* The "Create Profile" button section is removed.
               Profile creation should be part of the registration flow.
               The `profile` state here now refers to profile data within the `user` object.
               We can check if essential profile fields are present on the `user` object
               to decide if "Edit Profile" should be shown, or assume if `user` object exists,
               basic profile fields were set during registration.
               For simplicity, we'll assume `user` object implies profile exists for editing.
           */}
          
          <ThemedView style={styles.actionsContainer}>
            {user && ( // Show "Edit Profile" if the user object (which contains profile data) exists
              <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
                <ThemedText style={styles.buttonText}>Edit Profile</ThemedText>
              </TouchableOpacity>
            )}
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  settingsIcon: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  headerTitle: {
    fontSize: 28,
    flex: 1,
    textAlign: 'center',
    marginRight: 44, // Offset for the settings icon to keep title centered
  },
  profileCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bio: {
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Subscription styles
  subscriptionCard: {
    marginVertical: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  premiumBadge: {
    backgroundColor: '#673AB7', // Purple for premium
  },
  plusBadge: {
    backgroundColor: '#2196F3', // Blue for plus
  },
  freeBadge: {
    backgroundColor: '#4CAF50', // Green for free
  },
  tierText: {
    color: 'white',
    fontWeight: 'bold',
  },
  quotaBarContainer: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 8,
  },
  quotaBar: {
    height: '100%',
    borderRadius: 5,
  },
  quotaReset: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: 'right',
    marginBottom: 8,
  },
  subscriptionButton: {
    marginTop: 12,
  },
  // Profile detail styles
  detailsCard: {
    marginVertical: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    margin: 4,
  },
  interestText: {
    color: 'white',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  actionsContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButton: {
    backgroundColor: '#f44336',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
