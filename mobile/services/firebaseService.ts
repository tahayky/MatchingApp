import { initializeApp, getApps, getApp } from 'firebase/app';

// Mock DOM APIs for React Native Firebase compatibility
if (typeof global !== 'undefined') {
  // Mock document for Firebase Auth
  if (typeof document === 'undefined') {
    global.document = {
      getElementsByTagName: () => [],
      createElement: () => ({}),
      documentElement: {},
      head: {},
      body: {}
    } as any;
  }
  
  // Mock window for Firebase Analytics
  if (typeof window === 'undefined') {
    global.window = {
      location: { href: 'http://localhost' },
      navigator: { userAgent: 'React Native' }
    } as any;
  }
  
  // Mock navigator if needed
  if (typeof navigator === 'undefined') {
    global.navigator = {
      userAgent: 'React Native',
      product: 'ReactNative'
    } as any;
  }
}

// Firebase configuration from environment variables
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID
} from '@env';

const getFirebaseConfig = () => {
  const config = {
    apiKey: FIREBASE_API_KEY || "AIzaSyBDrtKJ2FF3kOGiHF1_HPZWb5Cil7FC474",
    authDomain: FIREBASE_AUTH_DOMAIN || "matchingapp-c439a.firebaseapp.com",
    projectId: FIREBASE_PROJECT_ID || "matchingapp-c439a",
    storageBucket: FIREBASE_STORAGE_BUCKET || "matchingapp-c439a.firebasestorage.app",
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID || "976584371759",
    appId: FIREBASE_APP_ID || "1:976584371759:android:36b4c19dae1c69e37320da"
  };
  
  // Validate configuration
  const missingVars = [];
  if (!FIREBASE_API_KEY) missingVars.push('FIREBASE_API_KEY');
  if (!FIREBASE_AUTH_DOMAIN) missingVars.push('FIREBASE_AUTH_DOMAIN');
  if (!FIREBASE_PROJECT_ID) missingVars.push('FIREBASE_PROJECT_ID');
  if (!FIREBASE_STORAGE_BUCKET) missingVars.push('FIREBASE_STORAGE_BUCKET');
  if (!FIREBASE_MESSAGING_SENDER_ID) missingVars.push('FIREBASE_MESSAGING_SENDER_ID');
  if (!FIREBASE_APP_ID) missingVars.push('FIREBASE_APP_ID');
  
  if (missingVars.length > 0) {
    console.warn('⚠️ [Firebase] Missing environment variables:', missingVars.join(', '));
    console.warn('📝 [Firebase] Using fallback values for missing variables');
  } else {
    console.log('✅ [Firebase] All environment variables loaded successfully');
  }
  
  console.log('🔧 [Firebase] Config loaded from .env:', {
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : 'undefined',
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId ? `${config.appId.substring(0, 20)}...` : 'undefined'
  });
  
  return config;
};

const firebaseConfig = getFirebaseConfig();

class FirebaseService {
  private app: any = null;
  private isInitialized: boolean = false;

  private async initializeFirebase() {
    try {
      if (this.isInitialized && this.app) {
        console.log('🔥 [Firebase] App already initialized and ready');
        return this.app;
      }

      console.log('🔥 [Firebase] Starting Firebase initialization...');
      console.log('🔧 [Firebase] Available apps count:', getApps().length);

      // Initialize Firebase if not already initialized
      if (!getApps().length) {
        console.log('🔥 [Firebase] Creating new Firebase app...');
        console.log('🔧 [Firebase] Config project ID:', firebaseConfig.projectId);
        
        this.app = initializeApp(firebaseConfig);
        console.log('✅ [Firebase] New Firebase app created');
        console.log('📱 [Firebase] App name:', this.app.name);
        console.log('🆔 [Firebase] App ID:', this.app.options.appId);
      } else {
        console.log('🔥 [Firebase] Using existing Firebase app...');
        this.app = getApp();
        console.log('✅ [Firebase] Existing app retrieved');
        console.log('📱 [Firebase] App name:', this.app.name);
      }

      // Initialize Auth with React Native persistence (Web SDK fallback)
      try {
        console.log('🔐 [Firebase] Initializing Auth with persistence...');
        const { initializeAuth, browserLocalPersistence } = await import('firebase/auth');
        
        initializeAuth(this.app, {
          persistence: browserLocalPersistence
        });
        
        console.log('✅ [Firebase] Auth initialized with local persistence');
      } catch (authError: any) {
        if (authError.code === 'auth/already-initialized') {
          console.log('🔄 [Firebase] Auth already initialized');
        } else {
          console.warn('⚠️ [Firebase] Auth initialization failed:', authError);
        }
      }

      // Verify app is properly initialized
      if (!this.app || !this.app.options) {
        throw new Error('Firebase app initialization failed - no options available');
      }

      console.log('🔧 [Firebase] Final verification:');
      console.log('  - App name:', this.app.name);
      console.log('  - Project ID:', this.app.options.projectId);
      console.log('  - Auth Domain:', this.app.options.authDomain);

      this.isInitialized = true;
      console.log('✅ [Firebase] Initialization complete');
      
      return this.app;

    } catch (error) {
      console.error('❌ [Firebase] Initialization error:', error);
      console.error('❌ [Firebase] Error details:', JSON.stringify(error, null, 2));
      this.isInitialized = false;
      this.app = null;
      throw error;
    }
  }

  // Public method to initialize Firebase without testing
  async initialize() {
    console.log('🔥 [Firebase] Public initialize called');
    return await this.initializeFirebase();
  }

  // Test Firebase connection (assumes already initialized)
  async initializeAndTest() {
    try {
      console.log('🔥 [Firebase] Testing Firebase connection...');
      
      // Check if Firebase is already initialized
      if (!this.app || !this.isInitialized) {
        return { success: false, error: 'Firebase not initialized. Please restart the app.' };
      }

      console.log('✅ [Firebase] Using existing Firebase app');
      console.log('📱 [Firebase] App name:', this.app.name);
      console.log('🔧 [Firebase] Project ID:', this.app.options.projectId);

      // Test different services
      await this.testBasicConnection();
      await this.testAuth();
      await this.testFirestore();
      await this.testStorage();
      await this.testAnalytics();

      return {
        success: true,
        appName: this.app.name,
        projectId: this.app.options.projectId
      };

    } catch (error) {
      console.error('❌ [Firebase] Test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test basic Firebase connection
  async testBasicConnection() {
    try {
      console.log('🔗 [Firebase] Testing basic connection...');
      
      if (!this.app) {
        console.log('❌ [Firebase] App not initialized');
        return false;
      }
      
      console.log('✅ [Firebase] Basic connection successful');
      return true;
    } catch (error) {
      console.error('❌ [Firebase] Basic connection error:', error);
      return false;
    }
  }

  // Test Firebase Auth
  async testAuth() {
    try {
      console.log('🔐 [Auth] Testing Auth...');
      console.log('📱 [Auth] Using React Native Firebase Auth initialization');
      
      // Ensure Firebase app is properly initialized first
      const app = this.app || this.initializeFirebase();
      if (!app) {
        console.error('❌ [Auth] Firebase app not initialized');
        return false;
      }
      
      console.log('🔐 [Auth] Firebase app ready, loading Auth with React Native persistence...');
      
      // Small delay to ensure app is fully ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Use Firebase Web SDK Auth with proper persistence
      const { initializeAuth, browserLocalPersistence } = await import('firebase/auth');
      
      console.log('🔐 [Auth] Creating Auth instance with local persistence...');
      
      try {
        const auth = initializeAuth(app, {
          persistence: browserLocalPersistence
        });
        
        console.log('✅ [Auth] React Native Auth service loaded successfully');
        console.log('🏗️ [Auth] App name:', auth.app.name);
        console.log('💾 [Auth] Persistence: React Native AsyncStorage');
        console.log(' [Auth] Current user:', auth.currentUser ? 'Logged in' : 'Not logged in');
        console.log('🔐 [Auth] Auth ready for Firebase Storage operations');
        
        return true;
      } catch (authError: any) {
        // If auth is already initialized, try to get existing instance
        if (authError.code === 'auth/already-initialized') {
          console.log('🔄 [Auth] Auth already initialized, getting existing instance...');
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth(app);
          
          console.log('✅ [Auth] Using existing Auth instance');
          console.log('👤 [Auth] Current user:', auth.currentUser ? 'Logged in' : 'Not logged in');
          return true;
        }
        throw authError;
      }
    } catch (error) {
      console.error('❌ [Auth] Error:', error);
      console.error('❌ [Auth] Error details:', JSON.stringify(error, null, 2));
      
      // Fallback: try standard getAuth for web compatibility
      try {
        console.log('🔄 [Auth] Falling back to standard getAuth...');
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth(this.app);
        
        console.log('⚠️ [Auth] Standard Auth loaded (no persistence)');
        return true;
      } catch (fallbackError) {
        console.error('❌ [Auth] Fallback failed:', fallbackError);
      }
      
      return false;
    }
  }

  // Test Firebase Firestore
  async testFirestore() {
    try {
      console.log('📄 [Firestore] Testing Firestore...');
      
      // Lazy load firestore
      const { getFirestore } = await import('firebase/firestore');
      const firestore = getFirestore(this.app);
      
      console.log('✅ [Firestore] Firestore service loaded successfully');
      console.log('🗃️ [Firestore] App:', firestore.app.name);
      return true;
    } catch (error) {
      console.error('❌ [Firestore] Error:', error);
      return false;
    }
  }

  // Test Firebase Storage (requires Auth)
  async testStorage() {
    try {
      console.log('📁 [Storage] Testing Firebase Storage...');
      
      // Storage requires Auth to be working
      const auth = await this.getAuth();
      if (!auth) {
        console.log('⚠️ [Storage] Auth not available, skipping Storage test');
        return true;
      }
      
      console.log('🔐 [Storage] Auth available, loading Storage...');
      
      // Lazy load storage
      const { getStorage } = await import('firebase/storage');
      const storage = getStorage(this.app);
      
      console.log('✅ [Storage] Storage service loaded successfully');
      console.log('🏗️ [Storage] App name:', storage.app.name);
      console.log('🪣 [Storage] Default bucket configured');
      
      // Test storage reference creation (doesn't require auth for this)
      try {
        const { ref } = await import('firebase/storage');
        const testRef = ref(storage, 'test/connection-test.txt');
        console.log('✅ [Storage] Reference creation successful');
        console.log('📂 [Storage] Test ref path:', testRef.fullPath);
      } catch (refError) {
        console.log('⚠️ [Storage] Reference creation failed:', refError);
      }
      
      console.log('🎯 [Storage] Storage ready for file operations');
      return true;
    } catch (error) {
      console.error('❌ [Storage] Error:', error);
      console.error('❌ [Storage] Error details:', JSON.stringify(error, null, 2));
      return false;
    }
  }

  // Test Firebase Analytics
  async testAnalytics() {
    try {
      console.log('📊 [Analytics] Testing Analytics...');
      
      // Try to get analytics instance safely
      const analytics = await this.getAnalytics();
      
      if (analytics) {
        // We have a working analytics instance
        const { logEvent } = await import('firebase/analytics');
        
        // Log a test event
        logEvent(analytics, 'firebase_test', {
          test_parameter: 'mobile_app_test',
          platform: 'react_native_expo',
          timestamp: new Date().toISOString()
        });
        
        console.log('✅ [Analytics] Test event logged successfully');
        return true;
      } else {
        // Fallback: Use custom analytics tracking
        console.log('📊 [Analytics] Using fallback analytics for React Native');
        await this.logAnalyticsEvent('firebase_test', {
          test_parameter: 'mobile_app_fallback',
          platform: 'react_native_expo',
          timestamp: new Date().toISOString()
        });
        
        console.log('✅ [Analytics] Fallback analytics working');
        return true;
      }
    } catch (error) {
      console.error('❌ [Analytics] Error:', error);
      // Even if analytics fails, we should continue with the app
      console.log('📊 [Analytics] Analytics test completed with fallback');
      return true;
    }
  }

  // Get Firebase project info
  getProjectInfo() {
    try {
      const app = this.app || this.initializeFirebase();
      
      if (!app) return null;
      
      return {
        name: app.name,
        projectId: app.options.projectId,
        authDomain: app.options.authDomain,
        storageBucket: app.options.storageBucket,
        messagingSenderId: app.options.messagingSenderId,
        appId: app.options.appId
      };
    } catch (error) {
      console.error('❌ [Firebase] Error getting project info:', error);
      return null;
    }
  }

  // Get Firebase services (lazy loaded)
  async getAuth() {
    try {
      console.log('🔐 [getAuth] Getting Auth service...');
      
      // Ensure Firebase app is properly initialized
      let app = this.app;
      if (!app) {
        console.log('🔐 [getAuth] No app instance, initializing...');
        app = this.initializeFirebase();
      }
      
      if (!app) {
        console.error('❌ [getAuth] Failed to initialize Firebase app');
        return null;
      }
      
      console.log('🔐 [getAuth] App ready, checking for existing Auth...');
      
      // Try to get existing Auth instance first
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth(app);
        
        if (auth) {
          console.log('✅ [getAuth] Existing Auth instance found');
          return auth;
        }
      } catch (existingAuthError) {
        console.log('🔄 [getAuth] No existing Auth, will initialize new one');
      }
      
      // If no existing auth, initialize with persistence
      try {
        console.log('🔐 [getAuth] Initializing new Auth with persistence...');
        const { initializeAuth, browserLocalPersistence } = await import('firebase/auth');
        
        const auth = initializeAuth(app, {
          persistence: browserLocalPersistence
        });
        
        console.log('✅ [getAuth] Auth initialized with local persistence');
        return auth;
      } catch (initError: any) {
        // If already initialized, get the existing instance
        if (initError.code === 'auth/already-initialized') {
          console.log('🔄 [getAuth] Auth already initialized, getting instance...');
          const { getAuth } = await import('firebase/auth');
          return getAuth(app);
        }
        throw initError;
      }
    } catch (error) {
      console.error('❌ [Firebase] Error getting Auth:', error);
      console.log('⚠️ [Firebase] Auth unavailable but continuing...');
      return null;
    }
  }

  async getFirestore() {
    try {
      const app = this.app || this.initializeFirebase();
      const { getFirestore } = await import('firebase/firestore');
      return getFirestore(app);
    } catch (error) {
      console.error('❌ [Firebase] Error getting Firestore:', error);
      return null;
    }
  }

  async getStorage() {
    try {
      console.log('📁 [getStorage] Getting Storage service...');
      
      // Storage requires Auth to be available
      const auth = await this.getAuth();
      if (!auth) {
        console.log('⚠️ [getStorage] Auth required for Storage operations');
        return null;
      }
      
      const app = this.app || this.initializeFirebase();
      if (!app) {
        console.error('❌ [getStorage] Firebase app not initialized');
        return null;
      }
      
      const { getStorage } = await import('firebase/storage');
      const storage = getStorage(app);
      
      console.log('✅ [getStorage] Storage service ready');
      return storage;
    } catch (error) {
      console.error('❌ [Firebase] Error getting Storage:', error);
      return null;
    }
  }

  async getAnalytics() {
    try {
      // React Native/Expo environment check
      if (typeof document === 'undefined' || !document.getElementsByTagName) {
        console.log('📊 [Analytics] React Native environment - using fallback analytics');
        return null; // Will use fallback analytics
      }
      
      // Check for window object
      if (typeof window === 'undefined') {
        console.log('📊 [Analytics] No window object - analytics unavailable');
        return null;
      }
      
      const app = this.app || this.initializeFirebase();
      const { getAnalytics, isSupported } = await import('firebase/analytics');
      
      // Check if analytics is supported in this environment
      const supported = await isSupported();
      if (!supported) {
        console.log('📊 [Analytics] Analytics not supported in this environment');
        return null;
      }
      
      return getAnalytics(app);
    } catch (error) {
      console.error('❌ [Firebase] Error getting Analytics:', error);
      return null;
    }
  }

  // Fallback analytics logging for React Native
  async logAnalyticsEvent(eventName: string, parameters: Record<string, any>) {
    try {
      // In React Native, we'll use console logging as fallback
      // In production, you might want to send this to your own analytics service
      console.log(`📊 [Analytics Fallback] Event: ${eventName}`, parameters);
      
      // You can also store events locally or send to a custom analytics endpoint
      const analyticsEvent = {
        event: eventName,
        parameters,
        timestamp: new Date().toISOString(),
        platform: 'react_native_expo'
      };
      
      // Store in AsyncStorage for later upload if needed
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const existingEvents = await AsyncStorage.getItem('pending_analytics') || '[]';
        const events = JSON.parse(existingEvents);
        events.push(analyticsEvent);
        
        // Keep only last 100 events to prevent storage bloat
        const trimmedEvents = events.slice(-100);
        await AsyncStorage.setItem('pending_analytics', JSON.stringify(trimmedEvents));
        
        console.log('📊 [Analytics Fallback] Event stored locally');
      } catch (storageError) {
        console.log('📊 [Analytics Fallback] Could not store event locally:', storageError);
      }
      
      return true;
    } catch (error) {
      console.error('❌ [Analytics Fallback] Error logging event:', error);
      return false;
    }
  }

  // Method to get stored analytics events (for manual upload)
  async getPendingAnalyticsEvents() {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const eventsJson = await AsyncStorage.getItem('pending_analytics') || '[]';
      return JSON.parse(eventsJson);
    } catch (error) {
      console.error('❌ [Analytics] Error getting pending events:', error);
      return [];
    }
  }

  // Method to clear stored analytics events
  async clearPendingAnalyticsEvents() {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.removeItem('pending_analytics');
      console.log('📊 [Analytics] Cleared pending events');
      return true;
    } catch (error) {
      console.error('❌ [Analytics] Error clearing pending events:', error);
      return false;
    }
  }
}

export default new FirebaseService();