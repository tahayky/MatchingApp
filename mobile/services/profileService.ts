import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profileCache } from '@/utils/cacheUtils';
import { checkInternetConnection } from '@/utils/networkUtils';

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
  gender?: 'male' | 'female' | 'other'; // Added gender field
  interestedIn?: ('male' | 'female' | 'other')[]; // Added interestedIn field
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
  message?: string; // Opsiyonel mesaj alanı eklendi
  profile: {
    _id: string;
    user: string;
    photos: Array<{
      _id: string;
      url: string;
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
    gender?: 'male' | 'female' | 'other'; // Added gender field
    interestedIn?: ('male' | 'female' | 'other')[]; // Added interestedIn field
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
  };
}

export interface DiscoverProfilesResponse {
  success: boolean;
  message?: string; // Opsiyonel mesaj alanı eklendi
  profiles: Array<{
    _id: string;
    user: {
      _id: string;
      name: string;
      dateOfBirth: string;
      gender: string;
    };
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
}

const profileService = {
  async createOrUpdateProfile(profileData: ProfileData): Promise<ProfileResponse> {
    // Authentication check
    if (!(await isAuthenticated())) {
      // Return a structure that matches ProfileResponse for consistency, even on auth failure
      return { success: false, message: 'User not authenticated', profile: null as any };
    }

    // Format interests if it's an array
    if (Array.isArray(profileData.interests)) {
      profileData.interests = profileData.interests.join(',');
    }

    try {
      // Check internet connection first
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }

      // Use the new endpoint: /api/users/profile
      const response = await apiClient.post<ProfileResponse>('/users/profile', profileData);
      return response.data;
    } catch (error) {
      console.error('Error creating/updating profile:', error);
      throw error; // Re-throw error to be caught by the component
    }
  },

  async getMyProfile(): Promise<ProfileResponse> {
    // Authentication check
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated', profile: null as any };
    }

    try {
      // Check internet connection first
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }

      // Use the new endpoint: /api/users/profile/me
      const response = await apiClient.get<ProfileResponse>('/users/profile/me');
      return response.data;
    } catch (error: any) {
      // 404 error is normal - means profile hasn't been created yet
      if (error.response?.status === 404) {
        return {
          success: false,
          profile: null as any,
          message: 'Profile not yet created' // English message
        };
      }

      // Handle other errors silently for now, or decide on specific error responses
      console.log('Error fetching profile (silent)');
      return { success: false, message: 'Error fetching profile', profile: null as any };
    }
  },

  async uploadProfilePhoto(photoFile: FormData): Promise<{ success: boolean; photo: { url: string; isMain: boolean }, photos?: any[] }> {
    // Authentication check
    if (!(await isAuthenticated())) {
      return { success: false, photo: { url: '', isMain: false } };
    }

    try {
      // Check internet connection first
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        throw new Error('No internet connection');
      }

      // Use the new endpoint: /api/users/profile/photos
      const response = await apiClient.post('/users/profile/photos', photoFile, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data; // Assuming backend sends back { success, photo, photos }
    } catch (error) {
      console.error('Error uploading photo:', error);
      return { success: false, photo: { url: '', isMain: false } };
    }
  },

  async setMainPhoto(photoId: string): Promise<{ success: boolean; message: string, photos?: any[] }> {
    // Authentication check
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      // Check internet connection first
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        return {
          success: false,
          message: 'No internet connection, cannot set main photo'
        };
      }

      // Use the new endpoint: /api/users/profile/photos/:photoId/main
      const response = await apiClient.put(`/users/profile/photos/${photoId}/main`);
      return response.data; // Assuming backend sends { success, message, photos }
    } catch (error) {
      console.error('Error setting main photo:', error);
      return { success: false, message: 'Operation failed' };
    }
  },

  async discoverProfiles(): Promise<DiscoverProfilesResponse> {
    // Authentication check
    if (!(await isAuthenticated())) {
      return { success: false, profiles: [], message: 'Not authenticated' };
    }

    try {
      // Check internet connection first
      const isConnected = await checkInternetConnection();

      if (!isConnected) {
        console.log('No internet connection, trying to load profiles from cache...');

        // Get profiles from cache
        const cachedProfiles = await profileCache.get();

        if (cachedProfiles && cachedProfiles.length > 0) {
          console.log(`Loaded ${cachedProfiles.length} profiles from cache`);
          return {
            success: true,
            profiles: cachedProfiles
          };
        } else {
          console.log('No profiles found in cache');
          return {
            success: false,
            profiles: [],
            message: 'No internet connection and no profiles found in cache'
          };
        }
      }

      // If internet connection exists, fetch new profiles from API
      console.log('Fetching profiles from API...');

      // Use the new endpoint: /api/users/profile/discover
      const response = await apiClient.get<DiscoverProfilesResponse>('/users/profile/discover');

      // If profiles successfully fetched from API, save to cache
      if (response.data.success && response.data.profiles.length > 0) {
        await profileCache.save(response.data.profiles);
        await profileCache.updateLastFetch();
        console.log(`Saved ${response.data.profiles.length} profiles to cache`);
      }

      return response.data;
    } catch (error: any) {
      console.log('API error, trying to load profiles from cache...', error);

      // Load from cache in case of API error
      const cachedProfiles = await profileCache.get();

      if (cachedProfiles && cachedProfiles.length > 0) {
        console.log(`Loaded ${cachedProfiles.length} profiles from cache after API error`);
        return {
          success: true,
          profiles: cachedProfiles
        };
      }

      // 404 error is normal - means profile hasn't been created yet
      if (error.response?.status === 404) {
        return {
          success: false,
          profiles: [],
          message: 'Profile not yet created' // English message
        };
      }

      // Handle other errors silently
      console.log('Error discovering profiles (silent)');
      return { success: false, profiles: [], message: 'Error discovering profiles' };
    }
  },

  // New method to get user information for profile editing
  async getUserInfo(): Promise<any> { // Consider defining a specific UserInfoResponse type
    // Authentication check
    if (!(await isAuthenticated())) {
      return { success: false, user: null, message: 'Not authenticated' };
    }

    try {
      // This endpoint should already be correct if it's fetching the User model directly
      const response = await apiClient.get('/users/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return { success: false, user: null, message: 'Error fetching user info' };
    }
  },

  // New method to update user information (gender, interestedIn)
  async updateUserInfo(userData: {
    gender?: 'male' | 'female' | 'other';
    interestedIn?: ('male' | 'female' | 'other')[];
    // Add other updatable user fields here if necessary, e.g., name, email
    name?: string;
    email?: string;
  }): Promise<any> { // Consider defining a specific UserUpdateResponse type
    // Authentication check
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      // This endpoint should already be correct
      const response = await apiClient.put('/users/me', userData);
      return response.data;
    } catch (error) {
      console.error('Error updating user info:', error);
      throw error; // Re-throw to be handled by the component
    }
  }
};

export default profileService;
