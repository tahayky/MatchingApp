import apiClient from './apiClient';

const testService = {
  /**
   * Test API connectivity by calling the health check endpoint.
   * This can be used to verify that the app can connect to the API server.
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Testing API connection...');
      const response = await apiClient.get('/health');
      console.log('Health check response:', response.data);
      return {
        success: true,
        message: 'Successfully connected to API server'
      };
    } catch (error) {
      console.error('API connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
};

export default testService;
