import apiClient from './apiClient';

export interface ProfileData {
  bio?: string;
  coordinates?: [number, number];
  city?: string;
  country?: string;
  interests?: string[] | string;
  occupation?: string;
  education?: string;
  height?: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  maxDistance?: number;
}

export interface ProfileResponse {
  success: boolean;
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
    // Format interests if it's an array
    if (Array.isArray(profileData.interests)) {
      profileData.interests = profileData.interests.join(',');
    }
    
    const response = await apiClient.post<ProfileResponse>('/profiles', profileData);
    return response.data;
  },
  
  async getMyProfile(): Promise<ProfileResponse> {
    const response = await apiClient.get<ProfileResponse>('/profiles/me');
    return response.data;
  },
  
  async uploadProfilePhoto(photoFile: FormData): Promise<{ success: boolean; photo: { url: string; isMain: boolean } }> {
    const response = await apiClient.post('/profiles/photos', photoFile, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  async setMainPhoto(photoId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.put(`/profiles/photos/${photoId}/main`);
    return response.data;
  },
  
  async discoverProfiles(): Promise<DiscoverProfilesResponse> {
    const response = await apiClient.get<DiscoverProfilesResponse>('/profiles/discover');
    return response.data;
  }
};

export default profileService;
