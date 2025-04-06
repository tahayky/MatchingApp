import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService } from '@/services';
import { apiClient, testService } from '@/services';
import { usePhysicalDeviceUrl, useSimulatorUrl } from '@/services/apiClient';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const response = await authService.login({
        email,
        password,
      });

      if (response.success) {
        Alert.alert('Success', 'Logged in successfully');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Login failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="title" style={styles.title}>Sign In</ThemedText>
          
          {/* API Connection Test Button */}
          <TouchableOpacity 
            style={styles.testConnectionButton}
            onPress={async () => {
              try {
                const result = await testService.testApiConnection();
                Alert.alert(
                  result.success ? 'Bağlantı Başarılı' : 'Bağlantı Hatası',
                  result.success 
                    ? `API sunucusuna bağlantı sağlandı: ${result.data?.message || 'Sunucu çalışıyor'}`
                    : `API sunucusuna bağlanılamadı: ${result.message}`
                );
              } catch (error) {
                Alert.alert('Hata', 'Bağlantı testi sırasında bir hata oluştu');
              }
            }}
          >
            <ThemedText style={styles.testConnectionText}>API Bağlantısını Test Et</ThemedText>
          </TouchableOpacity>
          
          <ThemedView style={styles.form}>
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Email</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </ThemedView>
            
            <ThemedView style={styles.inputContainer}>
              <ThemedText>Password</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </ThemedView>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.buttonText}>Sign In</ThemedText>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <ThemedText style={styles.link}>
                Don't have an account? Sign Up
              </ThemedText>
            </TouchableOpacity>
            
            {/* NOT: API hatalarını görmemek için normal giriş yapın */}

            {/* API URL Configuration Section */}
            <View style={styles.apiConfigSection}>
              <ThemedText style={styles.apiConfigTitle}>API URL Ayarları</ThemedText>
              
              <View style={styles.apiButtonRow}>
                <TouchableOpacity 
                  style={[styles.apiButton, styles.simulatorButton]} 
                  onPress={async () => {
                    await useSimulatorUrl();
                    Alert.alert('Başarılı', 'API URL simülatör/emülatör moduna ayarlandı');
                  }}
                >
                  <ThemedText style={styles.apiButtonText}>Simülatör/Emülatör</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.apiButton, styles.deviceButton]} 
                  onPress={async () => {
                    await usePhysicalDeviceUrl();
                    Alert.alert('Başarılı', 'API URL fiziksel cihaz moduna ayarlandı');
                  }}
                >
                  <ThemedText style={styles.apiButtonText}>Fiziksel Cihaz</ThemedText>
                </TouchableOpacity>
              </View>
              
              <ThemedText style={styles.apiConfigNote}>
                Giriş yapmadan önce doğru API URL'sini seçin.
              </ThemedText>
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    marginBottom: 20,
    textAlign: 'center',
  },
  testConnectionButton: {
    backgroundColor: '#673AB7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  testConnectionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: '#2196F3',
  },
  // API Configuration Styles
  apiConfigSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  apiConfigTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  apiButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 5,
  },
  apiButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  simulatorButton: {
    backgroundColor: '#4CAF50', // Green
  },
  deviceButton: {
    backgroundColor: '#FF9800', // Orange
  },
  apiButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  apiConfigNote: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
  },
  autoLoginButton: {
    backgroundColor: '#E91E63', // Pink
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  autoLoginText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
