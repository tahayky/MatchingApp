import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { authService, testService } from '@/services';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<{success: boolean, message: string} | null>(null);
  const [connectionTesting, setConnectionTesting] = useState(true);
  
  // Test API connection on screen load
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        setConnectionTesting(true);
        const result = await testService.testConnection();
        setApiStatus(result);
      } catch (error) {
        setApiStatus({
          success: false,
          message: error instanceof Error ? error.message : 'Connection error'
        });
      } finally {
        setConnectionTesting(false);
      }
    };
    
    checkApiConnection();
  }, []);

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
          
          {/* API Status Indicator */}
          {connectionTesting ? (
            <ThemedView style={styles.apiStatusContainer}>
              <ActivityIndicator size="small" />
              <ThemedText style={styles.apiStatusText}>Checking API connection...</ThemedText>
            </ThemedView>
          ) : apiStatus && (
            <ThemedView style={[
              styles.apiStatusContainer, 
              apiStatus.success ? styles.apiStatusSuccess : styles.apiStatusError
            ]}>
              <ThemedText style={styles.apiStatusText}>
                {apiStatus.success 
                  ? '✓ API Server is connected' 
                  : '✗ API Server connection failed'
                }
              </ThemedText>
            </ThemedView>
          )}
          
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
    marginBottom: 20, // Reduced from 40 to make room for API status
    textAlign: 'center',
  },
  apiStatusContainer: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiStatusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  apiStatusSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)', // Light green
  },
  apiStatusError: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)', // Light red
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
});
