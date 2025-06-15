import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  Switch,
  ScrollView, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Settings state
  const [darkModeEnabled, setDarkModeEnabled] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [locationEnabled, setLocationEnabled] = useState<boolean>(true);
  const [showDistance, setShowDistance] = useState<boolean>(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState<boolean>(true);
  
  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        
        // Get user data
        const userResponse = await authService.getCurrentUser();
        if (userResponse.success) {
          setUser(userResponse.user);
        }
        
        // Here we would normally load settings from the server or local storage
        // For now we just use default values
        
      } catch (error) {
        console.log('User data loading error');
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, []);

  const handleGoBack = () => {
    router.back();
  };
  
  const saveSettings = () => {
    // Here we would normally save settings to the server or local storage
    Alert.alert("Success", "Settings saved");
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      router.replace('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to logout');
    }
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
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>← Back</ThemedText>
          </TouchableOpacity>
          <ThemedText type="title" style={styles.headerTitle}>Settings</ThemedText>
          <ThemedView style={{ width: 50 }} />
        </ThemedView>
        
        <ThemedView style={styles.settingsCard}>
          <ThemedView style={styles.settingSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Subscription Settings</ThemedText>
            
            <TouchableOpacity
              style={styles.settingButton}
              onPress={() => router.push({ pathname: '/profile/subscription' } as any)}
            >
              <ThemedText>Premium Subscription</ThemedText>
              <ThemedText style={styles.settingDescription}>Get more like rights</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          <ThemedView style={styles.settingSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Display Settings</ThemedText>
            
            <ThemedView style={styles.settingRow}>
              <ThemedText>Dark Mode</ThemedText>
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
              />
            </ThemedView>
          </ThemedView>
          
          <ThemedView style={styles.settingSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Notification Settings</ThemedText>
            
            <ThemedView style={styles.settingRow}>
              <ThemedView style={styles.settingInfo}>
                <ThemedText>Enable Notifications</ThemedText>
                <ThemedText style={styles.settingDescription}>Get new match, message and like notifications</ThemedText>
              </ThemedView>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
              />
            </ThemedView>
          </ThemedView>
          
          <ThemedView style={styles.settingSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Privacy Settings</ThemedText>
            
            <ThemedView style={styles.settingRow}>
              <ThemedView style={styles.settingInfo}>
                <ThemedText>Location Sharing</ThemedText>
                <ThemedText style={styles.settingDescription}>Share your location with other users</ThemedText>
              </ThemedView>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
              />
            </ThemedView>
            
            <ThemedView style={styles.settingRow}>
              <ThemedText>Show Distance</ThemedText>
              <Switch
                value={showDistance}
                onValueChange={setShowDistance}
              />
            </ThemedView>
            
            <ThemedView style={styles.settingRow}>
              <ThemedText>Show Online Status</ThemedText>
              <Switch
                value={showOnlineStatus}
                onValueChange={setShowOnlineStatus}
              />
            </ThemedView>
          </ThemedView>
          
          <ThemedView style={styles.settingSection}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>Account Settings</ThemedText>
            
            <TouchableOpacity style={styles.settingButton}>
              <ThemedText>Change Password</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settingButton}>
              <ThemedText>Change Email</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.settingButton, styles.dangerButton]}>
              <ThemedText style={styles.dangerButtonText}>Freeze Account</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.settingButton, styles.dangerButton]}>
              <ThemedText style={styles.dangerButtonText}>Delete Account</ThemedText>
            </TouchableOpacity>
          </ThemedView>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveSettings}
          >
            <ThemedText style={styles.saveButtonText}>Save Settings</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <ThemedText style={styles.saveButtonText}>Logout</ThemedText>
          </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 50,
  },
  backButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
  },
  settingsCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  settingButton: {
    paddingVertical: 12,
    marginVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dangerButton: {
    marginTop: 8,
  },
  dangerButtonText: {
    color: '#f44336',
  },
  saveButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    marginTop: 10,
  },
});
