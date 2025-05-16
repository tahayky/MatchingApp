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
   // Accessing Next.js public environment variables
   // TypeScript might sometimes have trouble with 'process' in non-page files,
   // asserting to 'any' can bypass this if @types/node and next-env.d.ts are correctly set up
   // but still not resolving.
   // IMPORTANT: For client-side access in Next.js, env vars usually need NEXT_PUBLIC_ prefix.
   // If BACKEND_URL is used client-side without the prefix, it will be undefined.
   const baseUrl = (process.env as any).BACKEND_URL || DEFAULT_API_URL;
   
   const timeoutString = (process.env as any).NEXT_PUBLIC_API_TIMEOUT || DEFAULT_TIMEOUT.toString(); // Keeping timeout as NEXT_PUBLIC_ for now unless specified otherwise
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
 
 export default {
   getApiConfig,
   getApiUrl,
 };
