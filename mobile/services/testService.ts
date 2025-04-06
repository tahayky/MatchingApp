import apiClient from './apiClient';

// Test the API connection by hitting the public health check endpoint
export const testApiConnection = async () => {
  console.log('Testing API connection...');
  try {
    const response = await apiClient.get('/health');
    console.log('API connection test result:', response.data);
    return {
      success: true,
      message: 'API connection successful',
      data: response.data
    };
  } catch (error: any) {
    console.error('API connection test failed:', error);
    
    // 401 Unauthorized hatası özel bir durum - aslında bağlantı var ama yetkilendirme gerekiyor
    if (error.response && error.response.status === 401) {
      return {
        success: true,
        message: 'API bağlantısı başarılı, ancak kimlik doğrulama gerekiyor (401)',
        errorCode: 401
      };
    }
    
    // Diğer tüm API hataları da bir yanıt aldığımızı gösterir - bağlantı var
    if (error.response) {
      return {
        success: true, 
        message: `API'ye bağlantı kuruldu, ancak hata döndü: ${error.response.status}`,
        errorStatus: error.response.status
      };
    }
    
    // Network hatası, API'ye ulaşılamıyor
    return {
      success: false,
      message: 'API sunucusuna bağlanılamadı: ' + (error.message || 'Bilinmeyen hata'),
      error
    };
  }
};

export default {
  testApiConnection
};
