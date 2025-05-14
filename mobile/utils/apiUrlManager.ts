// API URL Yneticisi
// Uygulamanın doğru API URL'sine erişebilmesi için bir yardımcı sınıf
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL_IOS, API_URL_ANDROID, API_URL_DEVICE, USE_DEVICE_URL } from '@env';

// API URL'leri için değerler (doğrudan .env'den)
const API_URLS = {
  // iOS Simülatörü için
  iOS: API_URL_IOS,

  // Android Emülatörü için
  android: API_URL_ANDROID,

  // Varsayılan değer
  default: API_URL_IOS,

  // Gerçek cihazda test için
  device: API_URL_DEVICE
};

console.log('Doğrudan env değerleri:', {
  ENV_IOS_URL: API_URL_IOS,
  ENV_ANDROID_URL: API_URL_ANDROID,
  ENV_DEVICE_URL: API_URL_DEVICE,
  ENV_USE_DEVICE: USE_DEVICE_URL
});

export class ApiUrlManager {
  private static instance: ApiUrlManager;
  private _currentUrl: string = '';
  private _useDeviceUrl: boolean = USE_DEVICE_URL === 'true';

  // Singleton pattern
  private constructor() {
    // Doğrudan .env değerleri kullanılacağı için 
    // AsyncStorage'dan yüklemeye gerek yok
  }

  public static getInstance(): ApiUrlManager {
    if (!ApiUrlManager.instance) {
      ApiUrlManager.instance = new ApiUrlManager();
    }
    return ApiUrlManager.instance;
  }

  // Mevcut API URL'sini hesapla ve döndür
  public getApiUrl(): string {
    // URL zaten hesaplanmışsa, onu döndür
    if (this._currentUrl && this._currentUrl.length > 0) {
      return this._currentUrl;
    }

    // Fiziksel cihaz URL'si kullanılsın mı?
    if (this._useDeviceUrl) {
      this._currentUrl = API_URLS.device;
      console.log('API URL ayarlandı (Device modu: AÇIK):', this._currentUrl);
      return this._currentUrl;
    }

    // Platform bazlı URL seçimi
    this._currentUrl = Platform.select({
      ios: API_URLS.iOS,
      android: API_URLS.android,
      default: API_URLS.default
    }) as string;

    console.log('API URL ayarlandı (Platform bazlı):', this._currentUrl);
    return this._currentUrl;
  }
}

// API URL'sine ulaşmak için kolaylık sağlayıcı
export const getApiUrl = (): string => {
  const url = ApiUrlManager.getInstance().getApiUrl();
  console.log('👉 API Bağlantı URL:', url);
  return url;
};

export default ApiUrlManager.getInstance();
