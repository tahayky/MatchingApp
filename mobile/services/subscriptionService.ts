import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  tier: string;
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
      console.log('👉 API İSTEĞİ GÖNDERME: GET /subscription/status');
      const response = await apiClient.get<SubscriptionResponse>('/subscription/status');
      console.log('✅ Abonelik durumu alındı:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message || error);
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
      console.log('👉 API İSTEĞİ GÖNDERME: GET /matches/quota');
      const response = await apiClient.get<SubscriptionResponse>('/matches/quota');
      console.log('✅ Beğeni kotası bilgisi alındı:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message || error);
      throw error;
    }
  },

  // Format time until reset in a human-readable format
  formatTimeUntilReset(quotaInfo: QuotaInfo): string {
    if (!quotaInfo.timeUntilReset) {
      // If we don't have timeUntilReset, calculate from resetTime
      const resetTime = new Date(quotaInfo.resetTime);
      const now = new Date();
      const diffMs = resetTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        return 'Şimdi';
      }
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        return `${hours} saat ${minutes} dakika`;
      } else {
        return `${minutes} dakika`;
      }
    } else {
      const { hours, minutes } = quotaInfo.timeUntilReset;
      
      if (hours > 0) {
        return `${hours} saat ${minutes} dakika`;
      } else {
        return `${minutes} dakika`;
      }
    }
  }
};

export default subscriptionService;
