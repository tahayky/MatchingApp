import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RegisterParams {
  name: string;
  email: string;
  password: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  interestedIn: ('male' | 'female' | 'other')[];
}

interface LoginParams {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  user: {
    _id: string;
    name: string;
    email: string;
    gender: string;
    isProfileComplete?: boolean;
    token: string;
  };
}

// Test hesabı bilgileri - Backend tarafında bu hesabın kaydedilmiş olduğundan emin olun
const TEST_ACCOUNT = {
  email: 'test@test.com',  // Backend'de gerçekten var olan bir hesap
  password: 'test123'      // Backend'de gerçekten var olan şifre
};

const authService = {
  // Test amaçlı otomatik giriş
  async autoLogin(): Promise<AuthResponse> {
    try {
      console.log('Auto-login attempt with test account...');
      return await this.login(TEST_ACCOUNT);
    } catch (error) {
      console.error('Auto-login failed:', error);
      throw error;
    }
  },
  
  async register(params: RegisterParams): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', params);
    if (response.data.user.token) {
      await AsyncStorage.setItem('authToken', response.data.user.token);
      await AsyncStorage.setItem('userId', response.data.user._id);
    }
    return response.data;
  },
  
  async login(params: LoginParams): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', params);
    if (response.data.user.token) {
      await AsyncStorage.setItem('authToken', response.data.user.token);
      await AsyncStorage.setItem('userId', response.data.user._id);
    }
    return response.data;
  },
  
  async getCurrentUser() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
  
  async logout() {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userId');
  },
  
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('authToken');
    console.log('🔐 Kimlik doğrulama kontrolü - Token:', token ? token.substring(0, 15) + '...' : 'YOK');
    
    if (!token) {
      console.log('ℹ️ Token bulunamadı - Kullanıcı henüz giriş yapmamış');
      return false;
    }
    
    return true; // Token varsa kimlik doğrulanmış kabul et
  }
};

export default authService;
