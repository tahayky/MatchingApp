import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';

export default function AuthLayout() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Check if user is already logged in - prevent auth screen if they are
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        console.log('Auth Layout: Kimlik kontrolü yapılıyor...');
        const isAuthenticated = await authService.isAuthenticated();
        
        // If already authenticated, redirect to tabs
        if (isAuthenticated) {
          console.log('Auth Layout: Kullanıcı zaten giriş yapmış, ana sayfaya yönlendiriliyor');
          router.replace('/(tabs)');
        } else {
          console.log('Auth Layout: Kullanıcı giriş yapmamış, auth sayfasında kalıyor');
          setCheckingAuth(false);
        }
      } catch (error) {
        console.error('Auth Layout: Kimlik kontrolü hatası:', error);
        setCheckingAuth(false);
      }
    };
    
    checkAuthStatus();
  }, []);
  
  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 20 }}>Kontrol ediliyor...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Sign In',
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="register" 
        options={{ 
          title: 'Create Account',
          headerShown: false
        }} 
      />
    </Stack>
  );
}
