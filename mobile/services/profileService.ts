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
}

// Giriş yapılıp yapılmadığını kontrol eden yardımcı fonksiyon
const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  } catch (error) {
    console.log('Token kontrolünde hata:', error);
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
    // Kimlik doğrulama kontrolü
    if (!(await isAuthenticated())) {
      return { success: false, profile: null as any };
    }
    
    // Format interests if it's an array
    if (Array.isArray(profileData.interests)) {
      profileData.interests = profileData.interests.join(',');
    }
    
    try {
      // baseURL zaten /api içerdiğinden önek EKLEME
      const response = await apiClient.post<ProfileResponse>('/profiles', profileData);
      return response.data;
    } catch (error) {
      console.error('Profil oluşturma/güncelleme hatası:', error);
      return { success: false, profile: null as any };
    }
  },
  
  async getMyProfile(): Promise<ProfileResponse> {
    // Kimlik doğrulama kontrolü
    if (!(await isAuthenticated())) {
      return { success: false, profile: null as any };
    }
    
      try {
        // baseURL zaten /api içerdiğinden önek EKLEME
        const response = await apiClient.get<ProfileResponse>('/profiles/me');
        return response.data;
      } catch (error: any) {
        // 404 hatası normaldir - profil henüz oluşturulmamış demektir
        if (error.response?.status === 404) {
          return { 
            success: false, 
            profile: null as any, 
            message: 'Profil henüz oluşturulmamış'
          };
        }
        
        // Diğer hataları sessizce işle
        console.log('Profil getirme hatası (sessiz)');
        return { success: false, profile: null as any };
      }
  },
  
  async uploadProfilePhoto(photoFile: FormData): Promise<{ success: boolean; photo: { url: string; isMain: boolean } }> {
    // Kimlik doğrulama kontrolü
    if (!(await isAuthenticated())) {
      return { success: false, photo: { url: '', isMain: false } };
    }
    
    try {
      // baseURL zaten /api içerdiğinden önek EKLEME
      const response = await apiClient.post('/profiles/photos', photoFile, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Fotoğraf yükleme hatası:', error);
      return { success: false, photo: { url: '', isMain: false } };
    }
  },
  
  async setMainPhoto(photoId: string): Promise<{ success: boolean; message: string }> {
    // Kimlik doğrulama kontrolü
    if (!(await isAuthenticated())) {
      return { success: false, message: 'Giriş yapılmamış' };
    }
    
    try {
      // baseURL zaten /api içerdiğinden önek EKLEME
      const response = await apiClient.put(`/profiles/photos/${photoId}/main`);
      return response.data;
    } catch (error) {
      console.error('Ana fotoğraf ayarlama hatası:', error);
      return { success: false, message: 'İşlem başarısız' };
    }
  },
  
  async discoverProfiles(): Promise<DiscoverProfilesResponse> {
    // Kimlik doğrulama kontrolü
    if (!(await isAuthenticated())) {
      return { success: false, profiles: [] };
    }
    
    try {
      // Önce internet bağlantısını kontrol et
      const isConnected = await checkInternetConnection();
      
      if (!isConnected) {
        console.log('İnternet bağlantısı yok, önbellekten profil yükleme deneniyor...');
        
        // Önbellekten profilleri al
        const cachedProfiles = await profileCache.get();
        
        if (cachedProfiles && cachedProfiles.length > 0) {
          console.log(`Önbellekten ${cachedProfiles.length} profil yüklendi`);
          return { 
            success: true, 
            profiles: cachedProfiles 
          };
        } else {
          console.log('Önbellekte profil bulunamadı');
          return { 
            success: false, 
            profiles: [],
            message: 'İnternet bağlantısı yok ve önbellekte profil bulunamadı'
          };
        }
      }
      
      // İnternet bağlantısı varsa API'den yeni profilleri getir
      console.log('API\'den profiller alınıyor...');
      
      // baseURL zaten /api içerdiğinden önek EKLEME
      const response = await apiClient.get<DiscoverProfilesResponse>('/profiles/discover');
      
      // API'den başarıyla profiller alındıysa önbelleğe kaydet
      if (response.data.success && response.data.profiles.length > 0) {
        await profileCache.save(response.data.profiles);
        await profileCache.updateLastFetch();
        console.log(`${response.data.profiles.length} profil önbelleğe kaydedildi`);
      }
      
      return response.data;
    } catch (error: any) {
      console.log('API hatası, önbellekten profil yükleme deneniyor...', error);
      
      // API hatası durumunda önbellekten yükle
      const cachedProfiles = await profileCache.get();
      
      if (cachedProfiles && cachedProfiles.length > 0) {
        console.log(`Önbellekten ${cachedProfiles.length} profil yüklendi`);
        return { 
          success: true, 
          profiles: cachedProfiles 
        };
      }
      
      // 404 hatası normaldir - profil henüz oluşturulmamış demektir
      if (error.response?.status === 404) {
        return { 
          success: false, 
          profiles: [],
          message: 'Profil henüz oluşturulmamış'
        };
      }
      
      // Diğer hataları sessizce işle
      console.log('Profilleri keşfetme hatası (sessiz)');
      return { success: false, profiles: [] };
    }
  }
};

export default profileService;
