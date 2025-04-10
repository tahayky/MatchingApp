import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { matchCache } from '@/utils/cacheUtils';
import { checkInternetConnection } from '@/utils/networkUtils';

// Helper function remains the same
const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  } catch (error) {
    console.log('Token kontrolünde hata:', error);
    return false;
  }
};

// Interfaces remain the same
interface MatchActionParams {
  targetUserId: string;
  action: 'like' | 'pass';
}
interface MatchActionResponse {
  success: boolean;
  match: {
    targetUser: string;
    action: 'like' | 'pass';
    isMatch: boolean;
  };
  message?: string; // Optional message from backend
  quotaInfo?: {
    remaining: number;
    total: number;
    resetTime: string;
  };
}
export interface MatchProfile {
  matchId: string;
  userId: string;
  name: string;
  matchedAt: string;
  photo: string | null; // Keep as string | null
  lastActive: string;
}
interface MatchesResponse {
  success: boolean;
  message?: string;
  matches: MatchProfile[];
}

const matchService = {
  async likeOrPassUser(params: MatchActionParams): Promise<MatchActionResponse> {
    // Authentication check remains
    if (!(await isAuthenticated())) {
      // Return a clear failure response if not authenticated
      return {
        success: false,
        message: 'User not authenticated', // Add a message
        match: {
          targetUser: params.targetUserId,
          action: params.action,
          isMatch: false
        }
      };
    }

    // Define the SINGLE CORRECT endpoint path
    const endpointPath = '/matches/action'; // Relative to apiClient's baseURL

    try {
      console.log(`Eşleşme isteği gönderiliyor: POST ${endpointPath}`, params);

      // Make ONE attempt to the correct endpoint
      const response = await apiClient.post<MatchActionResponse>(endpointPath, params);

      // Check backend success status if necessary (optional, depends on backend)
      // if (!response.data.success) {
      //   console.warn(`Backend reported failure for ${endpointPath}:`, response.data.message);
      //   // Consider throwing an error here if backend 'success: false' should be treated as an error
      //   // throw new Error(response.data.message || 'Backend action failed');
      // }

      console.log(`✅ API yanıtı alındı: ${endpointPath}`, response.data);
      return response.data; // Return the actual data from the backend

    } catch (error: any) {
      // Catch errors from the single API call attempt
      console.error(`❌ API isteği başarısız: POST ${endpointPath}`, error.response?.data || error.message || error);

      // IMPORTANT: Re-throw the error or return a rejected Promise
      // This allows the calling function (HomeScreen) to catch the actual error
      throw error;

      /*
      // --- DO NOT DO THIS --- (This is the old incorrect way)
      // return {
      //   success: true, // FAKE SUCCESS
      //   match: {
      //     targetUser: params.targetUserId,
      //     action: params.action,
      //     isMatch: false // FAKE DATA
      //   }
      // };
      */
    }
  },

  // getMatches function remains largely the same, error handling seems acceptable (uses cache)
  async getMatches(): Promise<MatchesResponse> {
    if (!(await isAuthenticated())) {
      return { success: false, matches: [], message: 'User not authenticated' };
    }

    try {
      const isConnected = await checkInternetConnection();
      if (!isConnected) {
        console.log('İnternet bağlantısı yok, önbellekten eşleşmeler yükleniyor...');
        const cachedMatches = await matchCache.get();
        if (cachedMatches && cachedMatches.length > 0) {
          console.log(`Önbellekten ${cachedMatches.length} eşleşme yüklendi`);
          return { success: true, matches: cachedMatches };
        } else {
          console.log('Önbellekte eşleşme bulunamadı');
          return { success: false, matches: [], message: 'İnternet bağlantısı yok ve önbellekte eşleşme bulunamadı' };
        }
      }

      console.log('API\'den eşleşmeler alınıyor: GET /matches');
      const response = await apiClient.get<MatchesResponse>('/matches'); // Correct endpoint

      if (response.data.success && response.data.matches) { // Check matches array exists
         if (response.data.matches.length > 0) {
            await matchCache.save(response.data.matches);
            await matchCache.updateLastFetch();
            console.log(`${response.data.matches.length} eşleşme önbelleğe kaydedildi`);
         } else {
            console.log('API\'den eşleşme gelmedi (boş liste)');
            // Optionally clear cache if API returns empty list definitively
            // await matchCache.clear();
         }
      } else {
         console.warn('API eşleşmeleri getirme başarısız veya veri yok:', response.data.message);
         // Don't save to cache if API call wasn't successful
      }

      return response.data;

    } catch (error: any) {
      console.error('API hatası, önbellekten eşleşmeler yükleniyor...', error.response?.data || error.message || error);
      const cachedMatches = await matchCache.get();
      if (cachedMatches && cachedMatches.length > 0) {
        console.log(`Önbellekten ${cachedMatches.length} eşleşme yüklendi (API hatası sonrası)`);
        return { success: true, matches: cachedMatches };
      }
      console.error('Eşleşmeleri getirme hatası (önbellek de boş):', error);
      // Ensure a proper failure response is returned
      return { success: false, matches: [], message: 'API error and cache is empty' };
    }
  },

  // unmatch function remains largely the same, error handling returns generic failure
  async unmatch(matchId: string): Promise<{ success: boolean; message: string }> {
    if (!(await isAuthenticated())) {
      return { success: false, message: 'User not authenticated' };
    }

    const endpointPath = `/matches/${matchId}`; // Correct endpoint

    try {
      console.log(`Eşleşme silme isteği: DELETE ${endpointPath}`);
      const response = await apiClient.delete(endpointPath);
      console.log(`✅ Eşleşme silme başarılı: ${endpointPath}`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ Eşleşme silme hatası: DELETE ${endpointPath}`, error.response?.data || error.message || error);
      // Re-throwing might be better, but returning generic failure is also an option
      // throw error;
      return { success: false, message: error.response?.data?.message || 'Unmatch operation failed' };
    }
  }
};

export default matchService;
