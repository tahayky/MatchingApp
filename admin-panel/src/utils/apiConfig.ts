/**
 * API configuration utility that builds the API URL from environment variables
 * and provides other API-related configuration
 */

// Default values in case environment variables are not set
const DEFAULT_PROTOCOL = 'http';
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 3001;
const DEFAULT_BASE_PATH = '/api';
const DEFAULT_TIMEOUT = 30000;

// For client-side use
const getEnv = (key: string, defaultValue: string): string => {
  // When running on the client, we need to use NEXT_PUBLIC_ prefixed variables
  // First try with NEXT_PUBLIC_ prefix for client-side
  const clientKey = `NEXT_PUBLIC_${key}`;
  
  // For Next.js, process.env might contain any string key in the browser
  if (typeof process !== 'undefined' && process.env && process.env[clientKey as keyof typeof process.env]) {
    return process.env[clientKey as keyof typeof process.env] as string;
  }
  
  // Fall back to regular key (for server-side) or default
  return typeof process !== 'undefined' && process.env && process.env[key as keyof typeof process.env] 
    ? (process.env[key as keyof typeof process.env] as string)
    : defaultValue;
};

// Get environment variables with defaults
export const getApiConfig = () => {
  // Get values with fallbacks to defaults
  const protocol = getEnv('SERVER_PROTOCOL', DEFAULT_PROTOCOL);
  const host = getEnv('SERVER_HOST', DEFAULT_HOST);
  const port = getEnv('SERVER_PORT', DEFAULT_PORT.toString());
  const basePath = getEnv('API_BASE_PATH', DEFAULT_BASE_PATH);
  
  // Construct the complete API URL
  const baseUrl = `${protocol}://${host}:${port}${basePath}`;
  
  // Get the timeout value (if specified)
  const timeout = parseInt(getEnv('API_TIMEOUT', DEFAULT_TIMEOUT.toString()), 10);
  
  return {
    baseUrl,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    }
  };
};

// Create a configured API URL by appending the endpoint to the base URL
export const getApiUrl = (endpoint: string): string => {
  const { baseUrl } = getApiConfig();
  // Ensure endpoint doesn't start with slash if base URL ends with one
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  return `${baseUrl}/${formattedEndpoint}`;
};

export default {
  getApiConfig,
  getApiUrl,
};
