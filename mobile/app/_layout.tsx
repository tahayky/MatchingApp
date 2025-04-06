import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { authService } from '@/services';
import { OfflineNotice } from '@/components/OfflineNotice';
import { checkInternetConnection } from '@/utils/networkUtils';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  // For authentication flow
  const segments = useSegments();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check if the user is authenticated
  // Daha güçlü kimlik doğrulama kontrolü
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await authService.isAuthenticated();
        setIsAuthenticated(authenticated);
        
        const inAuthGroup = segments[0] === 'auth';
        
        if (!authenticated) {
          // Kimlik doğrulanmadıysa her zaman giriş ekranına yönlendir
          if (!inAuthGroup) {
            console.log('Kullanıcı oturum açmamış, giriş ekranına yönlendiriliyor...');
            router.replace('/auth');
          }
        } else {
          // Kimlik doğrulandıysa ve giriş ekranındaysa ana ekrana yönlendir
          if (inAuthGroup) {
            console.log('Kullanıcı zaten oturum açmış, ana ekrana yönlendiriliyor...');
            router.replace('/(tabs)');
          }
        }
      } catch (error) {
        console.error('Kimlik doğrulama kontrolünde hata:', error);
        // Hata durumunda güvenli taraf, giriş ekranına yönlendirmektir
        router.replace('/auth');
      }
    };
    
    // Başlangıçta ve segment değişikliklerinde kontrol et
    checkAuth();
  }, [segments]);
  
  // Ek olarak, uygulama açılışında da giriş durumunu kontrol et
  // İnternet bağlantısı kontrolü için state
  const [isConnected, setIsConnected] = useState<boolean>(true);
  
  // Uygulama yüklendiğinde ve fontlar hazır olduğunda çalışacak
  useEffect(() => {
    if (loaded) {
      const initialCheck = async () => {
        try {
          // Önce internet bağlantısı kontrolü yap
          const hasConnection = await checkInternetConnection();
          setIsConnected(hasConnection);
          
          // İnternet bağlantısı durumunu kaydet, ama uygulamayı engelleme
          if (!hasConnection) {
            console.log('İnternet bağlantısı yok, banner gösterilecek...');
            // Devam et, banner bağlantı olmadığını gösterecek
          }
          
          // İnternet bağlantısı varsa kimlik doğrulama kontrolü yap
          const authenticated = await authService.isAuthenticated();
          if (!authenticated) {
            // Uygulama açılışında giriş yapılmamışsa doğrudan giriş ekranına yönlendir
            console.log('Başlangıç kontrolü: Kullanıcı oturum açmamış');
            router.replace('/auth');
          }
        } catch (error) {
          console.error('Başlangıç kontrolünde hata:', error);
          router.replace('/auth');
        }
        
        // Başlangıç kontrolünden sonra splash screen'i kapat
        SplashScreen.hideAsync();
      };
      
      initialCheck();
    }
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
