/**
 * API configuration utility that builds the API URL from environment variables
 * and provides other API-related configuration
 */
 
 // Default values in case environment variables are not set
 const DEFAULT_API_URL = 'http://localhost:3000/api'; // Default full API URL
 const DEFAULT_TIMEOUT = 30000; // Default timeout in milliseconds
 
 // Get environment variables with defaults
 // In Next.js, client-side code can only access env vars prefixed with NEXT_PUBLIC_
 
 export const getApiConfig = () => {
   // Accessing Next.js public environment variables directly.
   // Next.js ensures these are available on process.env in the client-side bundle.
   
   const backendUrlFromEnv = process.env.NEXT_PUBLIC_BACKEND_URL;
   const timeoutFromEnv = process.env.NEXT_PUBLIC_API_TIMEOUT;
 
   // Diagnostic log:
   if (typeof window !== 'undefined') { // Log only on client-side
     console.log('[apiConfig] process.env.NEXT_PUBLIC_BACKEND_URL:', backendUrlFromEnv);
     console.log('[apiConfig] process.env.NEXT_PUBLIC_API_TIMEOUT:', timeoutFromEnv);
   }
 
   const baseUrl = backendUrlFromEnv || DEFAULT_API_URL;
   const timeoutString = timeoutFromEnv || DEFAULT_TIMEOUT.toString();
   const timeout = parseInt(timeoutString, 10);
   
   return {
     baseUrl: baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl, // Ensure no trailing slash
     timeout,
     headers: {
       'Content-Type': 'application/json',
     }
   };
 };
 
 // Create a configured API URL by appending the endpoint to the base URL
 export const getApiUrl = (endpoint: string): string => {
   const { baseUrl } = getApiConfig();
   // Ensure endpoint starts with a slash if not already, and baseUrl does not end with one.
   const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
   return `${baseUrl}${formattedEndpoint}`;
 };
 
 const apiConfigUtils = {
   getApiConfig,
   getApiUrl,
 };
 
 export default apiConfigUtils;
