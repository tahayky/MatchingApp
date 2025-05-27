import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';

export default function SplashScreen() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  
  // Check auth status and redirect after a short delay
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        console.log('Splash: Oturum durumu kontrol ediliyor...');
        
        // Kısa bir delay - splash ekranı görmek için
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const authenticated = await authService.isAuthenticated();
        console.log('Splash: Oturum durumu:', authenticated ? 'Açık' : 'Kapalı');
        
        // Yönlendirme
        if (authenticated) {
          console.log('Splash: Kullanıcı giriş yapmış, ana sayfaya yönlendiriliyor');
          router.replace('/(tabs)');
        } else {
          console.log('Splash: Kullanıcı giriş yapmamış, hoşgeldin sayfasına yönlendiriliyor');
          router.replace('/auth/welcome');
        }
      } catch (error) {
        console.error('Splash: Oturum kontrolü hatası:', error);
        // Hata durumunda hoşgeldin sayfasına yönlendir
        router.replace('/auth/welcome');
      }
    };
    
    checkAuthAndRedirect();
  }, []);
  
  // Yükleme ekranı göster - uygulama logosu ile
  return (
    <ThemedView style={styles.container}>
      <Image 
        source={require('@/assets/images/splash-icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" style={styles.loader} />
      <ThemedText style={styles.text}>Yükleniyor...</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 30
  },
  loader: {
    marginVertical: 20
  },
  text: {
    fontSize: 16,
    marginTop: 10
  }
});
