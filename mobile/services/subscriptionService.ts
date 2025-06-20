import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveToCache, getFromCache, clearCache } from '@/utils/cacheUtils';
import { checkInternetConnection } from '@/utils/networkUtils';

// Cache keys
const QUOTA_CACHE_KEY = 'like_quota';
const SUBSCRIPTION_STATUS_CACHE_KEY = 'subscription_status';
const QUOTA_SESSION_KEY = 'quota_session_id';

// Types for subscription functionality
export interface SubscriptionTier {
  id: string;
  name: string;
  dailyLikeQuota: number;
  description: string;
  features: string[];
  price?: {
    monthly: number;
    yearly: number;
  };
}

export interface QuotaInfo {
  remaining: number;
  total: number;
  resetTime: string;
  timeUntilReset?: {
    hours: number;
    minutes: number;
    milliseconds: number;
  };
}

export interface SubscriptionStatus {
  tier: string; // This is the planId, e.g., 'FREE', 'PLUS'
  name?: string; // The display name of the tier, e.g., "Free", "Plus"
  expiresAt: string | null;
  hasExpired: boolean;
  features: string[];
  quotaInfo: QuotaInfo;
}

export interface SubscriptionResponse {
  success: boolean;
  tiers?: SubscriptionTier[];
  subscription?: SubscriptionStatus;
  message?: string;
  quotaInfo?: QuotaInfo;
}

// Helper function to check authentication
const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  } catch (error) {
    console.log('Token kontrolünde hata:', error);
    return false;
  }
};

// Check if this is a new quota session (first time opening app)
const isNewQuotaSession = async (): Promise<boolean> => {
  try {
    const storedSessionId = await AsyncStorage.getItem(QUOTA_SESSION_KEY);
    
    if (!storedSessionId) {
      // İlk açılış - session ID kaydet ve fresh veri çek
      const currentSessionId = Date.now().toString();
      await AsyncStorage.setItem(QUOTA_SESSION_KEY, currentSessionId);
      return true;
    }
    
    // Session mevcut - cache'den veri dön (timeout yok)
    // Fresh veri sadece değişiklik sonrası cache temizlendiğinde çekilecek
    return false;
  } catch (error) {
    return true; // Hata durumunda fresh data çek
  }
};

// Helper function to clear quota cache when quota changes
const clearQuotaCache = async () => {
  await clearCache(QUOTA_CACHE_KEY);
  console.log('[SubscriptionService] Quota cache\'i temizlendi - değişiklik yapıldı');
};

// Helper function to clear subscription cache when subscription changes
const clearSubscriptionCache = async () => {
  await clearCache(SUBSCRIPTION_STATUS_CACHE_KEY);
  console.log('[SubscriptionService] Subscription cache\'i temizlendi - değişiklik yapıldı');
};

const subscriptionService = {
  // Get all available subscription tiers
  async getSubscriptionTiers(): Promise<SubscriptionResponse> {
    try {
      console.log('👉 API İSTEĞİ GÖNDERME: GET /subscription/tiers');
      const response = await apiClient.get<SubscriptionResponse>('/subscription/tiers');
      console.log('✅ Abonelik paketleri alındı:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message || error);
      throw error;
    }
  },

  // Get current user's subscription status
  async getSubscriptionStatus(): Promise<SubscriptionResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated' };
    }

    try {
      // Yeni uygulama oturumunu kontrol et
      const isNewSession = await isNewQuotaSession();
      
      if (!isNewSession) {
        // Cache'den veri dön
        const cachedStatus = await getFromCache(SUBSCRIPTION_STATUS_CACHE_KEY) as SubscriptionResponse;
        if (cachedStatus && cachedStatus.success !== undefined) {
          console.log('[SubscriptionService] Cache\'den subscription status döndürülüyor');
          return cachedStatus;
        }
      }
      
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        // İnternet yoksa cache'den dön
        const cachedStatus = await getFromCache(SUBSCRIPTION_STATUS_CACHE_KEY) as SubscriptionResponse;
        if (cachedStatus && cachedStatus.success !== undefined) {
          console.log('[SubscriptionService] İnternet yok - cache\'den subscription status döndürülüyor');
          return cachedStatus;
        }
        throw new Error('No internet connection');
      }

      console.log('[SubscriptionService] Fresh subscription status verisi çekiliyor - sebep:', isNewSession ? 'yeni uygulama oturumu' : 'cache bulunamadı');
      console.log('👉 API İSTEĞİ GÖNDERME: GET /subscription/status');
      const response = await apiClient.get<SubscriptionResponse>('/subscription/status');
      console.log('✅ Abonelik durumu alındı:', response.data);
      
      // Cache'e kaydet
      if (response.data.success) {
        await saveToCache(SUBSCRIPTION_STATUS_CACHE_KEY, response.data);
        console.log('[SubscriptionService] Taze subscription status verisi cache\'e kaydedildi');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message || error);
      
      // Hata durumunda cache'den dön
      const cachedStatus = await getFromCache(SUBSCRIPTION_STATUS_CACHE_KEY) as SubscriptionResponse;
      if (cachedStatus && cachedStatus.success !== undefined) {
        console.log('[SubscriptionService] API hatası - cache\'den subscription status döndürülüyor');
        return cachedStatus;
      }
      
      throw error;
    }
  },

  // Upgrade to a paid subscription tier
  async upgradeSubscription(tierId: string, durationMonths: number = 1): Promise<SubscriptionResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated' };
    }

    try {
      console.log(`👉 API İSTEĞİ GÖNDERME: POST /subscription/upgrade (tierId: ${tierId}, duration: ${durationMonths} months)`);
      const response = await apiClient.post<SubscriptionResponse>('/subscription/upgrade', {
        tierId,
        durationMonths
      });
      console.log('✅ Abonelik yükseltme başarılı:', response.data);
      
      // Başarılı abonelik yükseltme sonrası cache'leri temizle
      if (response.data.success) {
        await clearSubscriptionCache();
        await clearQuotaCache(); // Quota da değişmiş olabilir
      }
      
      return response.data;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message || error);
      throw error;
    }
  },

  // Get current like quota status
  async getLikeQuota(): Promise<SubscriptionResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated' };
    }

    try {
      // Yeni uygulama oturumunu kontrol et
      const isNewSession = await isNewQuotaSession();
      
      if (!isNewSession) {
        // Cache'den veri dön
        const cachedQuota = await getFromCache(QUOTA_CACHE_KEY) as SubscriptionResponse;
        if (cachedQuota && cachedQuota.success !== undefined) {
          console.log('[SubscriptionService] Cache\'den quota döndürülüyor');
          return cachedQuota;
        }
      }
      
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        // İnternet yoksa cache'den dön
        const cachedQuota = await getFromCache(QUOTA_CACHE_KEY) as SubscriptionResponse;
        if (cachedQuota && cachedQuota.success !== undefined) {
          console.log('[SubscriptionService] İnternet yok - cache\'den quota döndürülüyor');
          return cachedQuota;
        }
        throw new Error('No internet connection');
      }

      console.log('[SubscriptionService] Fresh quota verisi çekiliyor - sebep:', isNewSession ? 'yeni uygulama oturumu' : 'cache bulunamadı');
      console.log('👉 API İSTEĞİ GÖNDERME: GET /matches/quota');
      const response = await apiClient.get<SubscriptionResponse>('/matches/quota');
      console.log('✅ Beğeni kotası alındı:', response.data);
      
      // Cache'e kaydet
      if (response.data.success) {
        await saveToCache(QUOTA_CACHE_KEY, response.data);
        console.log('[SubscriptionService] Taze quota verisi cache\'e kaydedildi');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('API Error fetching like quota:', error.response?.data || error.message || error);
      
      // Hata durumunda cache'den dön
      const cachedQuota = await getFromCache(QUOTA_CACHE_KEY) as SubscriptionResponse;
      if (cachedQuota && cachedQuota.success !== undefined) {
        console.log('[SubscriptionService] API hatası - cache\'den quota döndürülüyor');
        return cachedQuota;
      }
      
      // Fallback error response
      const resetTime = new Date();
      resetTime.setDate(resetTime.getDate() + 1);
      resetTime.setHours(0, 0, 0, 0);

      return {
        success: false,
        message: `Abonelik bilgisi alınamadı: ${error.message || 'Bilinmeyen bir hata oluştu.'}`,
        quotaInfo: {
          remaining: 0,
          total: 0,
          resetTime: resetTime.toISOString(),
        }
      };
    }
  },

  // Force refresh quota (after like operations)
  async refreshLikeQuota(): Promise<SubscriptionResponse> {
    await clearQuotaCache();
    return this.getLikeQuota();
  },

  // Force refresh subscription status (after subscription changes)
  async refreshSubscriptionStatus(): Promise<SubscriptionResponse> {
    await clearSubscriptionCache();
    return this.getSubscriptionStatus();
  },

  // Format time until reset in a human-readable format
  formatTimeUntilReset(quotaInfo: QuotaInfo): string {
    if (!quotaInfo.timeUntilReset) {
      // If we don't have timeUntilReset, calculate from resetTime
      const resetTime = new Date(quotaInfo.resetTime);
      const now = new Date();
      const diffMs = resetTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        return 'Now';
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    } else {
      const { hours, minutes } = quotaInfo.timeUntilReset;

      if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    }
  }
};

export default subscriptionService;
