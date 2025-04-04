import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL configuration from environment variables
import { Platform } from 'react-native';
import { API_URL_IOS, API_URL_ANDROID, API_URL_DEVICE, USE_LOCAL_IP } from '@env';

// Parse boolean from env variable
const useLocalIp = USE_LOCAL_IP === 'true';

// Choose API URL based on platform and configuration
const API_URL = useLocalIp
  ? API_URL_DEVICE // Use local network IP when testing on a physical device
  : Platform.select({
      ios: API_URL_IOS,
      android: API_URL_ANDROID,
      default: API_URL_IOS,
    });

console.log('Using API URL:', API_URL);

// Create an axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token to requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from AsyncStorage:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 (Unauthorized) errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Could implement token refresh here if needed
      
      // For now, just clear the token and let the user re-authenticate
      await AsyncStorage.removeItem('authToken');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
