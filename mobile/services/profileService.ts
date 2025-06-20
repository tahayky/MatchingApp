import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileCache, saveToCache, getFromCache, clearCache } from '@/utils/cacheUtils';
import { checkInternetConnection } from '@/utils/networkUtils';

// Cache key for my profile
const MY_PROFILE_CACHE_KEY = 'my_profile';
const APP_SESSION_KEY = 'app_session_id';

// Helper function to clear profile cache when profile is updated
const clearProfileCache = async () => {
  await clearCache(MY_PROFILE_CACHE_KEY);
  console.log('[ProfileService] Profil cache\'i temizlendi - değişiklik yapıldı');
};

// Check if this is a new app session (first time opening app)
const isNewAppSession = async (): Promise<boolean> => {
  try {
    const storedSessionId = await AsyncStorage.getItem(APP_SESSION_KEY);
    
    if (!storedSessionId) {
      // İlk açılış - session ID kaydet ve fresh veri çek
      const currentSessionId = Date.now().toString();
      await AsyncStorage.setItem(APP_SESSION_KEY, currentSessionId);
      return true;
    }
    
    // Session mevcut - cache'den veri dön (timeout yok)
    // Fresh veri sadece değişiklik sonrası cache temizlendiğinde çekilecek
    return false;
  } catch (error) {
    return true; // Hata durumunda fresh data çek
  }
};

export interface ProfileData {
  bio: string;
  city: string;
  country: string;
  interests: string[] | string;
  occupation: string;
  education: string;
  coordinates?: number[];
  height?: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  maxDistance?: number;
  gender?: 'male' | 'female' | 'other'; 
  interestedIn?: ('male' | 'female' | 'other')[]; 
}

// Helper function to check if logged in
const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  } catch (error) {
    console.log('Error checking token:', error);
    return false;
  }
};

export interface ProfileResponse {
  success: boolean;
  message?: string; 
  profile: {
    _id: string;
    user: string;
    photos: Array<{
      _id: string;
      filename: string;
      selfViewUrl?: string; // Self-view URL for user's own photos
      selfViewUrlExpiration?: string; // ISO date string
      isMain: boolean;
    }>;
    bio?: string;
    location?: {
      coordinates: [number, number];
      city?: string;
      country?: string;
    };
    interests?: string[];
    occupation?: string;
    education?: string;
    height?: number;
    gender?: 'male' | 'female' | 'other'; 
    interestedIn?: ('male' | 'female' | 'other')[]; 
    preferences?: {
      ageRange?: {
        min: number;
        max: number;
      };
      distance?: number;
    };
    lastActive: string;
    createdAt: string;
    updatedAt: string;
  } | null; // Allow profile to be null for consistency on auth failure
}

export interface DiscoverProfilesResponse {
  success: boolean;
  message?: string; 
  profiles: Array<{
    _id: string;
    user: { // This structure might be simplified if backend sends full user object directly
      _id: string;
      name: string;
      dateOfBirth: string; 
      gender: string;
    };
    name: string; // Added name directly for easier access, assuming backend sends it
    age?: number; 
    photos: Array<{
      _id: string;
      url: string;
      isMain: boolean;
    }>;
    bio?: string;
    location?: {
      city?: string;
      country?: string;
    };
    interests?: string[];
    occupation?: string;
    education?: string;
  }>;
  pagination?: { 
    currentPage: number;
    totalPages: number;
    totalProfiles: number;
    limit: number;
  };
}

const profileService = {
  async createOrUpdateProfile(profileData: ProfileData): Promise<ProfileResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated', profile: null };
    }

    if (Array.isArray(profileData.interests)) {
      profileData.interests = profileData.interests.join(',');
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }
      const response = await apiClient.post<ProfileResponse>('/users/profile', profileData);
      
      // Başarılı profil güncelleme sonrası cache'i temizle
      if (response.data.success) {
        await clearProfileCache();
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating/updating profile:', error);
      throw error;
    }
  },

  async getMyProfile(): Promise<ProfileResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated', profile: null };
    }

    try {
      // Yeni uygulama oturumunu kontrol et
      const isNewSession = await isNewAppSession();
      
      if (!isNewSession) {
        // Cache'den veri dön
        const cachedProfile = await getFromCache(MY_PROFILE_CACHE_KEY) as ProfileResponse;
        if (cachedProfile && cachedProfile.success !== undefined) {
          console.log('[ProfileService] Cache\'den profil döndürülüyor');
          return cachedProfile;
        }
      }
      
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        // İnternet yoksa cache'den dön
        const cachedProfile = await getFromCache(MY_PROFILE_CACHE_KEY) as ProfileResponse;
        if (cachedProfile && cachedProfile.success !== undefined) {
          console.log('[ProfileService] İnternet yok - cache\'den profil döndürülüyor');
          return cachedProfile;
        }
        throw new Error('No internet connection');
      }
      
      console.log('[ProfileService] Fresh profil verisi çekiliyor - sebep:', isNewSession ? 'yeni uygulama oturumu' : 'cache bulunamadı');
      const response = await apiClient.get<ProfileResponse>('/users/profile/me');
      
      // Cache'e kaydet
      if (response.data.success) {
        await saveToCache(MY_PROFILE_CACHE_KEY, response.data);
      }
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          success: false,
          profile: null,
          message: 'Profile not yet created'
        };
      }
      
      // Hata durumunda cache'den dön
      const cachedProfile = await getFromCache(MY_PROFILE_CACHE_KEY) as ProfileResponse;
      if (cachedProfile && cachedProfile.success !== undefined) {
        console.log('[ProfileService] API hatası - cache\'den profil döndürülüyor');
        return cachedProfile;
      }
      
      console.log('Error fetching profile:', error.message);
      return { success: false, message: 'Error fetching profile', profile: null };
    }
  },

  async uploadProfilePhotoFormData(formData: FormData): Promise<{ success: boolean; photo?: { _id: string; filename: string; isMain: boolean; selfViewUrl?: string; selfViewUrlExpiration?: string }, photos?: any[], message?: string }> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }
      
      // Get token for auth
      const token = await AsyncStorage.getItem('authToken');
      const url = `${apiClient.defaults.baseURL}/users/profile/photos`;
      
      console.log('📤 Using FormData + fetch for photo upload...');
      console.log('🌐 Upload URL:', url);
      console.log('🔑 Token length:', token?.length || 0);
      
      // Test server connectivity first
      console.log('🔍 Testing server connectivity...');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const testResponse = await fetch(`${apiClient.defaults.baseURL}/users/profile/me`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        console.log('✅ Server test response status:', testResponse.status);
      } catch (testError) {
        console.log('❌ Server connectivity test failed:', testError);
        throw new Error('Server unreachable');
      }
      
      // Use native fetch with FormData (no Content-Type header)
      console.log('📤 Starting FormData upload...');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // NO Content-Type - let fetch set multipart boundary
        },
        body: formData,
      });
      
      console.log('📥 Upload response status:', response.status);
      console.log('📥 Upload response headers:', response.headers);
      
      const result = await response.json();
      console.log('📥 Upload response body:', result);
      
      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }
      
      // Başarılı foto upload sonrası cache'i temizle
      if (result.success) {
        await clearProfileCache();
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Error uploading photo with FormData:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      const errorMessage = error.message || 'Error uploading photo';
      return { success: false, message: errorMessage };
    }
  },

  // Legacy method for backward compatibility
  async uploadProfilePhoto(photoData: { data: string; mimeType: string; name: string; size?: number } | FormData): Promise<{ success: boolean; photo?: { _id: string; filename: string; isMain: boolean; selfViewUrl?: string; selfViewUrlExpiration?: string }, photos?: any[], message?: string }> {
    // If it's FormData, use the new method
    if (photoData instanceof FormData) {
      return this.uploadProfilePhotoFormData(photoData);
    }
    
    // Otherwise use base64 method (fallback)
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }
      
      // Get token for auth
      const token = await AsyncStorage.getItem('authToken');
      
      console.log('📤 Using base64 for photo upload...');
      console.log('📊 Photo data size:', JSON.stringify(photoData).length, 'chars');
      
      const response = await fetch(`${apiClient.defaults.baseURL}/users/profile/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(photoData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }
      
      return result;
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      const errorMessage = error.message || 'Error uploading photo';
      return { success: false, message: errorMessage };
    }
  },

  async uploadMultiplePhotos(photoFiles: FormData): Promise<{
    success: boolean;
    uploadedPhotos?: any[];
    failedUploads?: string[];
    totalPhotos?: any[];
    message?: string;
  }> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }
      const response = await apiClient.post('/users/profile/photos/bulk', photoFiles, {
        headers: {
          // Content-Type'ı manuel set etmeyin, axios otomatik boundary set eder
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error uploading multiple photos:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error uploading photos';
      return { success: false, message: errorMessage };
    }
  },

  async deletePhoto(photoId: string): Promise<{ success: boolean; message?: string; photos?: any[] }> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        return {
          success: false,
          message: 'No internet connection, cannot delete photo'
        };
      }
      const response = await apiClient.delete(`/users/profile/photos/${photoId}`);
      
      // Başarılı foto silme sonrası cache'i temizle
      if (response.data.success) {
        await clearProfileCache();
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error deleting photo';
      return { success: false, message: errorMessage };
    }
  },

  async setMainPhoto(photoId: string): Promise<{ success: boolean; message: string, photos?: any[] }> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        return {
          success: false,
          message: 'No internet connection, cannot set main photo'
        };
      }
      const response = await apiClient.put(`/users/profile/photos/${photoId}/main`);
      
      // Başarılı ana foto değişikliği sonrası cache'i temizle
      if (response.data.success) {
        await clearProfileCache();
      }
      
      return response.data;
    } catch (error) {
      console.error('Error setting main photo:', error);
      return { success: false, message: 'Operation failed' };
    }
  },

  async discoverProfiles(page: number = 1, limit?: number): Promise<DiscoverProfilesResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, profiles: [], message: 'Not authenticated', pagination: undefined };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        console.log('No internet connection for discoverProfiles.');
        return {
          success: false,
          profiles: [],
          message: 'No internet connection. Cannot fetch new profiles.',
          pagination: undefined
        };
      }

      // Load preferences from AsyncStorage and add as query parameters
      let filterParams = '';
      try {
        const prefsString = await AsyncStorage.getItem('userPreferences');
        if (prefsString) {
          const preferences = JSON.parse(prefsString);
          const params = new URLSearchParams();
          
          if (preferences.ageRangeMin) params.append('ageRangeMin', preferences.ageRangeMin.toString());
          if (preferences.ageRangeMax) params.append('ageRangeMax', preferences.ageRangeMax.toString());
          if (preferences.maxDistance) params.append('maxDistance', preferences.maxDistance.toString());
          
          if (params.toString()) {
            filterParams = '&' + params.toString();
            console.log(`[Discover] Adding filter parameters: ${filterParams}`);
          }
        }
      } catch (error) {
        console.log('[Discover] Error loading preferences from AsyncStorage:', error);
      }

      // Build URL with filters
      let url = `/users/profile/discover?page=${page}`;
      if (limit) url += `&limit=${limit}`;
      url += filterParams;
      
      console.log(`Fetching profiles from API... URL: ${url}`);
      const response = await apiClient.get<DiscoverProfilesResponse>(url);
      
      // Example: only cache first page for simplicity with pagination
      if (response.data.success && response.data.profiles.length > 0 && page === 1) {
        await profileCache.save(response.data.profiles);
        await profileCache.updateLastFetch();
        console.log(`Saved ${response.data.profiles.length} profiles (first page) to cache`);
      }

      return response.data; // This should now include the pagination object from backend
    } catch (error: any) {
      console.log('Error discovering profiles:', error.message);
      // If error has a response (e.g. 429 from rate limit), log headers and rethrow
      if (error.response) {
          console.log('Error response status from server:', error.response.status);
          console.log('Error response headers from server:', JSON.stringify(error.response.headers, null, 2));
          console.log('Error response data from server:', error.response.data);
          throw error;
      }
      return { success: false, profiles: [], message: error.message || 'Error discovering profiles', pagination: undefined };
    }
  },

  async getUserInfo(): Promise<any> { 
    if (!(await isAuthenticated())) {
      return { success: false, user: null, message: 'Not authenticated' };
    }
    try {
      const response = await apiClient.get('/users/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return { success: false, user: null, message: 'Error fetching user info' };
    }
  },

  async updateUserInfo(userData: {
    gender?: 'male' | 'female' | 'other';
    interestedIn?: ('male' | 'female' | 'other')[];
    name?: string;
    email?: string;
  }): Promise<any> { 
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }
    try {
      const response = await apiClient.put('/users/me', userData);
      
      // Başarılı kullanıcı bilgi güncellemesi sonrası cache'i temizle
      if (response.data.success) {
        await clearProfileCache();
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating user info:', error);
      throw error; 
    }
  }
};

// Export the standalone function for direct use with new session tracking
export const getMyProfile = async (forceRefresh = false): Promise<ProfileResponse> => {
  try {
    console.log('[ProfileService] getMyProfile çağrıldı, forceRefresh:', forceRefresh);
    
    // Yeni uygulama oturumunu kontrol et
    const isNewSession = await isNewAppSession();
    const shouldFetchFresh = forceRefresh || isNewSession;
    
    if (shouldFetchFresh) {
      console.log('[ProfileService] Taze veri çekiliyor - sebep:', isNewSession ? 'yeni uygulama oturumu' : 'force refresh');
      
      const response = await apiClient.get('/users/profile/me');
      
      // Cache the fresh data
      await saveToCache(MY_PROFILE_CACHE_KEY, response.data);
      console.log('[ProfileService] Taze profil verisi cache\'e kaydedildi');
      
      return response.data;
    }
    
    // Cache'den veri dön
    const cachedProfile = await getFromCache(MY_PROFILE_CACHE_KEY) as ProfileResponse;
    if (cachedProfile && cachedProfile.success !== undefined) {
      console.log('[ProfileService] Cache\'den profil döndürülüyor');
      return cachedProfile;
    }
    
    // Cache yoksa API'den çek
    console.log('[ProfileService] Cache bulunamadı, API\'den çekiliyor');
    const response = await apiClient.get('/users/profile/me');
    await saveToCache(MY_PROFILE_CACHE_KEY, response.data);
    
    return response.data;
  } catch (error) {
    console.error('[ProfileService] getMyProfile hatası:', error);
    
    // Fallback to cache if available
    const cachedProfile = await getFromCache(MY_PROFILE_CACHE_KEY) as ProfileResponse;
    if (cachedProfile && cachedProfile.success !== undefined) {
      console.log('[ProfileService] API hatası - cache\'den profil döndürülüyor');
      return cachedProfile;
    }
    
    throw error;
  }
};

export default profileService;
