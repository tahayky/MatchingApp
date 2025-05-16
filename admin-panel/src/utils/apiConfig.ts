/**
 * API configuration utility that builds the API URL from environment variables
 * and provides other API-related configuration
 */
 
 // Default values in case environment variables are not set
 const DEFAULT_API_URL = 'http://localhost:3000/api'; // Default full API URL
 const DEFAULT_TIMEOUT = 30000; // Default timeout in milliseconds
 
 // Get environment variables with defaults
 // In Next.js, client-side code can only access env vars prefixed with NEXT_PUBLIC_
 
 // Define a type for the expected structure of process.env for these specific variables
 interface AppEnv {
   NEXT_PUBLIC_BACKEND_URL?: string; // Changed from BACKEND_URL
   NEXT_PUBLIC_API_TIMEOUT?: string;
   [key: string]: string | undefined; // Allow other string properties if necessary
 }
 
 // Helper to safely access process.env, assuming it might be undefined in some contexts
 // or if 'process' itself is not typed correctly by the TS environment.
 const currentEnv = (typeof process !== 'undefined' && process.env ? process.env : {}) as AppEnv;
 
 export const getApiConfig = () => {
   // Accessing Next.js public environment variables
   // Environment variables MUST be prefixed with NEXT_PUBLIC_ to be exposed to the browser.
   
   // Diagnostic log:
   if (typeof window !== 'undefined') { // Log only on client-side
     // console.log('[apiConfig] Raw process.env.NEXT_PUBLIC_BACKEND_URL:', (process.env as any).NEXT_PUBLIC_BACKEND_URL); // This would cause lint error
     console.log('[apiConfig] Value from currentEnv.NEXT_PUBLIC_BACKEND_URL:', currentEnv.NEXT_PUBLIC_BACKEND_URL);
     // Next.js makes NEXT_PUBLIC_ variables available on process.env client-side.
     // The 'process' type issue should be resolved if `npm install` was successful and `next-env.d.ts` is working.
     console.log('[apiConfig] Direct process.env.NEXT_PUBLIC_BACKEND_URL (client-side):', process.env.NEXT_PUBLIC_BACKEND_URL);
   }
 
   const baseUrl = currentEnv.NEXT_PUBLIC_BACKEND_URL || DEFAULT_API_URL;
   
   const timeoutString = currentEnv.NEXT_PUBLIC_API_TIMEOUT || DEFAULT_TIMEOUT.toString();
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
