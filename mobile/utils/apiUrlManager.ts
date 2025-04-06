// API URL Yöneticisi
// Uygulamanın doğru API URL'sine erişebilmesi için bir yardımcı sınıf
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL'leri
const API_URLS = {
  // iOS Simülatörü için
  iOS: 'http://localhost:3000/api',
  
  // Android Emülatörü için
  android: 'http://10.0.2.2:3000/api',
  
  // Varsayılan değer
  default: 'http://localhost:3000/api',
  
  // Gerçek cihazda test için
  device: 'http://192.168.1.105:3000/api'
};

export class ApiUrlManager {
  private static instance: ApiUrlManager;
  private _currentUrl: string | null = null;
  private _useDeviceUrl: boolean = false;

  // Singleton pattern
  private constructor() {
    this.initializeFromStorage();
  }

  public static getInstance(): ApiUrlManager {
    if (!ApiUrlManager.instance) {
      ApiUrlManager.instance = new ApiUrlManager();
    }
    return ApiUrlManager.instance;
  }

  // AsyncStorage'dan verileri yükle
  private async initializeFromStorage() {
    try {
      const useDeviceUrl = await AsyncStorage.getItem('USE_DEVICE_URL');
      if (useDeviceUrl === 'true') {
        this._useDeviceUrl = true;
      }
      
      // Custom device URL varsa kullan
      const customDeviceUrl = await AsyncStorage.getItem('CUSTOM_DEVICE_URL');
      if (customDeviceUrl) {
        API_URLS.device = customDeviceUrl;
      }
    } catch (error) {
      console.error('Error loading API URL config from storage:', error);
    }
    
    // URL'yi sıfırla
    this._currentUrl = null;
  }

  // Fiziksel cihaz URL'si kullanımını ayarla
  public async setUseDeviceUrl(use: boolean): Promise<void> {
    this._useDeviceUrl = use;
    try {
      await AsyncStorage.setItem('USE_DEVICE_URL', use ? 'true' : 'false');
      // URL'yi sıfırla
      this._currentUrl = null;
    } catch (error) {
      console.error('Error saving USE_DEVICE_URL to storage:', error);
    }
  }

  // Fiziksel cihaz URL'sini özelleştir
  public async setCustomDeviceUrl(url: string): Promise<void> {
    if (!url.endsWith('/api')) {
      url = url + '/api';
    }
    
    API_URLS.device = url;
    try {
      await AsyncStorage.setItem('CUSTOM_DEVICE_URL', url);
      // URL'yi sıfırla
      this._currentUrl = null;
    } catch (error) {
      console.error('Error saving CUSTOM_DEVICE_URL to storage:', error);
    }
  }

  // Mevcut API URL'sini hesapla ve döndür
  public getApiUrl(): string {
    // URL zaten hesaplanmışsa, onu döndür
    if (this._currentUrl) {
      return this._currentUrl;
    }
    
    // Fiziksel cihaz URL'si kullanılsın mı?
    if (this._useDeviceUrl) {
      this._currentUrl = API_URLS.device;
      return this._currentUrl;
    }
    
    // Platform bazlı URL seçimi
    this._currentUrl = Platform.select({
      ios: API_URLS.iOS,
      android: API_URLS.android,
      default: API_URLS.default
    }) as string;
    
    return this._currentUrl;
  }
}

// API URL'sine ulaşmak için kolaylık sağlayıcı
export const getApiUrl = (): string => {
  return ApiUrlManager.getInstance().getApiUrl();
};

export default ApiUrlManager.getInstance();
