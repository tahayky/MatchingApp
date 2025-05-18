import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ActivityIndicator, View } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { GenieLampIcon } from '@/components/ui/GenieLampIcon';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { authService } from '@/services';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Tab Layout: Checking authentication');
        const authenticated = await authService.isAuthenticated();
        
        console.log('Tab Layout: Authentication status:', authenticated ? 'Logged in' : 'Logged out');
        
        setIsAuthenticated(authenticated);
        
        if (!authenticated) {
          // If not authenticated, redirect to auth
          console.log('Tab Layout: User not authenticated, redirecting to login screen...');
          router.replace('/auth');
        }
      } catch (error) {
        console.error('Tab Layout: Authentication error:', error);
        setIsAuthenticated(false);
        router.replace('/auth');
      }
    };
    
    checkAuth();
  }, []);
  
  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <ThemedView style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" />
        <ThemedText style={{marginTop: 20}}>Authenticating...</ThemedText>
      </ThemedView>
    );
  }
  
  // If not authenticated, should redirect but just in case, show a message
  if (isAuthenticated === false) {
    return (
      <ThemedView style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ThemedText>You need to log in</ThemedText>
      </ThemedView>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarShowLabel: false, // Remove tab labels, show only icons
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
            height: 100,
            paddingTop: 10,
            paddingBottom: 40,
            bottom: 0,
          },
          default: {
            height: 100,
            paddingTop: 10,
            paddingBottom: 40,
            marginBottom: 0,
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discovery',
          tabBarIcon: ({ color }) => <GenieLampIcon size={44} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => <IconSymbol size={44} name="message.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Likes',
          tabBarIcon: ({ color }) => <IconSymbol size={44} name="heart.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={44} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
