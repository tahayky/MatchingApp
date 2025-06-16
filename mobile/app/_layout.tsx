import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { authService } from '@/services';
import { OfflineNotice } from '@/components/OfflineNotice';
import { checkInternetConnection } from '@/utils/networkUtils';
import firebaseService from '@/services/firebaseService';

// Ensure splash screen setup is correct
try {
  SplashScreen.preventAutoHideAsync();
  console.log("Splash screen prevention successful");
} catch (e) {
  console.warn("Error setting up splash screen:", e);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  // For authentication flow
  const segments = useSegments();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // İnternet bağlantısı kontrolü için state
  const [isConnected, setIsConnected] = useState<boolean>(true);
  
  // Sadece splash screen kapatma ve internet bağlantısı kontrolü yap
  useEffect(() => {
    if (!loaded) return;
    
    const initialize = async () => {
      try {
        // Firebase'i başlangıçta initialize et
        console.log('🔥 [App] Initializing Firebase on app start...');
        await firebaseService.initialize();
        
        // İnternet bağlantısı kontrolü
        const hasConnection = await checkInternetConnection();
        setIsConnected(hasConnection);
        
        if (!hasConnection) {
          console.log('İnternet bağlantısı yok, banner gösterilecek...');
        }
      } catch (error) {
        console.error('Başlangıç kontrolünde hata:', error);
      } finally {
        // Splash screen'i kapatmaya çalış
        try {
          console.log("Splash screen kapatılıyor...");
          await SplashScreen.hideAsync();
        } catch (e) {
          console.warn("Splash screen kapatma hatası:", e);
        }
      }
    };
    
    initialize();
  }, [loaded]);
  
  // Her 10 saniyede bir internet bağlantısını kontrol et
  useEffect(() => {
    const connectionInterval = setInterval(async () => {
      const hasConnection = await checkInternetConnection();
      setIsConnected(hasConnection);
    }, 10000);
    
    return () => clearInterval(connectionInterval);
  }, []);

  // Not: Eski hideAsync kaldırıldı çünkü initialCheck içinde zaten bunu yapıyoruz

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* Bağlantı kesildiğinde gösterilecek offline uyarısı */}
        <OfflineNotice />
        
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
