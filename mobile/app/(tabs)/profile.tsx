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

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService, profileService } from '@/services';
import apiClient, { setUseDeviceUrl, setCustomDeviceUrl } from '@/services/apiClient';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const [authenticated, setAuthenticated] = useState<boolean>(false);

  // İlk yüklemede kimlik doğrulama kontrolü
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await authService.isAuthenticated();
        setAuthenticated(isAuth);
        
        if (isAuth) {
          // Sadece giriş yapıldıysa veri yükle
          loadUserData();
        } else {
          // Giriş yapılmadıysa yükleme durumunu kapat
          setLoading(false);
        }
      } catch (error) {
        console.log('Kimlik doğrulama kontrolü hatası (sessiz)');
        setAuthenticated(false);
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  // Sayfaya her gelindiğinde ve kimlik doğrulanmışsa yeniden veri yükle
  useFocusEffect(
    React.useCallback(() => {
      if (authenticated) {
        loadUserData();
      }
      return () => {};
    }, [authenticated])
  );

  const loadUserData = async () => {
    // Güvenlik kontrolü - sadece kimlik doğrulanmışsa API istekleri yap
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
        console.log('Profile not found, may need to be created (sessiz)');
      }
    } catch (error) {
      console.log('Kullanıcı verisi yükleme hatası (sessiz)');
      // Müşteriye hata mesajı gösterme, sadece iç log tutma
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
        </ThemedView>
        
        <ThemedView style={styles.profileCard}>
          <ThemedView style={styles.profileHeader}>
            <Image 
              source={
                profile?.photos?.find((p: any) => p.isMain)?.url 
                  ? { uri: profile.photos.find((p: any) => p.isMain).url }
                  : require('@/assets/images/react-logo.png')
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
          
          {!profile && (
            <ThemedView style={styles.emptyState}>
              <ThemedText>You haven't created a profile yet.</ThemedText>
              <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
                <ThemedText style={styles.buttonText}>Create Profile</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          )}
          
          <ThemedView style={styles.actionsContainer}>
            {profile && (
              <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
                <ThemedText style={styles.buttonText}>Edit Profile</ThemedText>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.button}
              onPress={() => router.push('/profile/settings')}
            >
              <ThemedText style={styles.buttonText}>Ayarlar</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.logoutButton]} 
              onPress={handleLogout}
            >
              <ThemedText style={styles.buttonText}>Logout</ThemedText>
            </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    marginBottom: 10,
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
