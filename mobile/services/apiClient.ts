import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// .env dosyasından direkt çevre değişkenlerini import et
// Bu değişkenlerin değerleri derleme zamanında yerleştirilir
import { 
  API_URL_IOS as ENV_IOS_URL, 
  API_URL_ANDROID as ENV_ANDROID_URL, 
  API_URL_DEVICE as ENV_DEVICE_URL, 
  USE_DEVICE_URL as ENV_USE_DEVICE 
} from '@env';

// Çevre değişkenlerini kontrol et ve logla
console.log('Doğrudan env değerleri:', {
  ENV_IOS_URL,
  ENV_ANDROID_URL, 
  ENV_DEVICE_URL,
  ENV_USE_DEVICE
});

// API URL'leri için varsayılan değerler
const DEFAULT_URLS = {
  ios: 'http://localhost:3000/api',
  android: 'http://10.0.2.2:3000/api',
  device: 'http://192.168.1.20:3000/api'
};

// Env değerlerini veya varsayılanları kullan
const API_URLS = {
  ios: ENV_IOS_URL || DEFAULT_URLS.ios,
  android: ENV_ANDROID_URL || DEFAULT_URLS.android,
  device: ENV_DEVICE_URL || DEFAULT_URLS.device
};

// Device URL kullanılacak mı kontrol et (string "true" ise true kabul et)
const useDeviceUrl = ENV_USE_DEVICE === 'true';

// Başlangıç URL'sini belirle
let currentApiUrl = useDeviceUrl
  ? API_URLS.device // "true" ise fiziksel cihaz URL'sini kullan
  : Platform.select({
      ios: API_URLS.ios,
      android: API_URLS.android,
      default: API_URLS.ios
    }) as string;

console.log(`API URL ayarlandı (Device modu: ${useDeviceUrl ? 'AÇIK' : 'KAPALI'}):`, currentApiUrl);

// Create an axios instance with default config
const apiClient = axios.create({
  baseURL: currentApiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tam URL loglama
console.log('👉 API Bağlantı URL:', currentApiUrl);
// Test Loglama - Tam URL'nin nasıl görüldüğünü görelim
apiClient.interceptors.request.use(
  (config) => {
    // URL format düzeltmeleri - her durumda çalışacak şekilde
    let url = config.url || '';
    
    // URL başında slash olduğundan emin ol
    if (!url.startsWith('/') && !url.startsWith('http')) {
      url = '/' + url;
    }
    
    // Çift slash'ları temizle (//) -> (/)
    url = url.replace(/\/+/g, '/');
    
    // Çift /api/api durumunu engelle
    if (url.startsWith('/api/api/')) {
      url = url.replace('/api/api/', '/api/');
    }
    
    // Güncellenen URL'yi configde ayarla
    config.url = url;
    
    // Tam URL'yi logla
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(`👉 API İSTEĞİ GÖNDERME: ${config.method?.toUpperCase()} ${fullUrl}`);
    
    return config;
  },
  (error) => Promise.reject(error)
);

// .env dosyasındaki USE_DEVICE_URL değerini güncelle
const updateEnvValue = async (key: string, value: string) => {
  try {
    const envPath = FileSystem.documentDirectory + '../../../.env';
    let content = '';
    
    try {
      content = await FileSystem.readAsStringAsync(envPath);
    } catch (error) {
      console.log('Env file not found or unable to read');
      return false;
    }
    
    // Değeri değiştir veya ekle
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (content.match(regex)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    
    await FileSystem.writeAsStringAsync(envPath, content);
    console.log(`Updated ${key} to ${value} in .env file`);
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    return false;
  }
};

// Gerçek cihazda test etmek için
export const usePhysicalDeviceUrl = async () => {
  currentApiUrl = API_URLS.device;
  apiClient.defaults.baseURL = currentApiUrl;
  
  // .env dosyasını güncelle
  await updateEnvValue('USE_DEVICE_URL', 'true');
  
  console.log('Switched to physical device URL:', currentApiUrl);
};

// Simülatör/emülatörde test etmek için
export const useSimulatorUrl = async () => {
  currentApiUrl = Platform.select({
    ios: API_URLS.ios,
    android: API_URLS.android,
    default: API_URLS.ios,
  }) as string;
  
  apiClient.defaults.baseURL = currentApiUrl;
  
  // .env dosyasını güncelle
  await updateEnvValue('USE_DEVICE_URL', 'false');
  
  console.log('Switched to simulator URL:', currentApiUrl);
};

// Uyumluluk için ek fonksiyonlar
export const setUseDeviceUrl = async (use: boolean) => {
  if (use) {
    await usePhysicalDeviceUrl();
  } else {
    await useSimulatorUrl();
  }
  return true;
};

export const setCustomDeviceUrl = async (url: string) => {
  if (!url.endsWith('/api')) {
    url = url + '/api';
  }
  
  // Önce .env dosyasını güncelle
  await updateEnvValue('API_URL_DEVICE', url);
  
  // Fiziksel cihaz modu aktifse hemen URL'yi değiştir
  if (ENV_USE_DEVICE === 'true' || useDeviceUrl) {
    currentApiUrl = url;
    apiClient.defaults.baseURL = url;
  }
  
  console.log('Set custom device URL:', url);
  return true;
};

// Request interceptor to add auth token to requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        // Doğru Authorization başlık formatı
        config.headers.Authorization = `Bearer ${token}`;
        console.log('📝 Token eklendi, token:', token.substring(0, 15) + '...');
      } else {
        console.log('⚠️ Token bulunamadı veya geçersiz! API isteği yetkisiz olacak.');
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
    
    // Beklenen hatalar - bunları sadece geliştirme ortamında konsola yazdır
    const expectedErrors = [
      // Public endpoint
      { url: '/health', status: 401 },
      
      // Profil henüz oluşturulmadığında normal 404 hataları
      { url: '/profiles/me', status: 404 },
      { url: '/profiles/discover', status: 404 }
    ];
    
    // Hata beklenen bir hata mı?
    const isExpectedError = expectedErrors.some(e => 
      originalRequest?.url?.includes(e.url) && error.response?.status === e.status
    );
    
    // Sadece beklenmeyen hataları konsola yazdır
    if (!isExpectedError) {
      console.error('API Error:', {
        url: originalRequest?.url,
        status: error.response?.status,
        method: originalRequest?.method,
        message: error.message
      });
    }
    
    // 401 hatalarını sessizce işle, sadece log'la ve token'ı temizle
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 401 hatasını sadece geliştirme ortamında konsola yazdır
      if (__DEV__) {
        console.log('Auth token missing or invalid, clearing token');
      }
      
      // Token'ı temizle
      await AsyncStorage.removeItem('authToken');
      
      // Özel hata mesajı oluştur - sadece orijinal hatayı koruyarak
      error.friendlyMessage = 'Oturum süresi dolmuş olabilir. Lütfen tekrar giriş yapın.';
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
