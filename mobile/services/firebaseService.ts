import { initializeApp, getApps, getApp } from 'firebase/app';

// Firebase configuration from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyBDrtKJ2FF3kOGiHF1_HPZWb5Cil7FC474",
  authDomain: "matchingapp-c439a.firebaseapp.com",
  projectId: "matchingapp-c439a",
  storageBucket: "matchingapp-c439a.firebasestorage.app",
  messagingSenderId: "976584371759",
  appId: "1:976584371759:android:36b4c19dae1c69e37320da"
};

class FirebaseService {
  private app: any = null;
  private isInitialized: boolean = false;

  private initializeFirebase() {
    try {
      if (this.isInitialized) {
        return this.app;
      }

      // Initialize Firebase if not already initialized
      if (!getApps().length) {
        this.app = initializeApp(firebaseConfig);
        console.log('🔥 [Firebase] Firebase initialized');
      } else {
        this.app = getApp();
        console.log('🔥 [Firebase] Using existing Firebase app');
      }

      this.isInitialized = true;
      return this.app;

    } catch (error) {
      console.error('❌ [Firebase] Initialization error:', error);
      throw error;
    }
  }

  // Initialize Firebase and test connection
  async initializeAndTest() {
    try {
      console.log('🔥 [Firebase] Testing Firebase connection...');
      
      // Initialize Firebase first
      const app = this.initializeFirebase();
      
      if (!app) {
        return { success: false, error: 'Firebase app initialization failed' };
      }

      console.log('✅ [Firebase] Firebase app initialized');
      console.log('📱 [Firebase] App name:', app.name);
      console.log('🔧 [Firebase] Project ID:', app.options.projectId);

      // Test different services
      await this.testBasicConnection();
      await this.testAuth();
      await this.testFirestore();
      await this.testAnalytics();

      return {
        success: true,
        appName: app.name,
        projectId: app.options.projectId
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
      
      // Lazy load auth
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth(this.app);
      
      console.log('✅ [Auth] Auth service loaded successfully');
      console.log('👤 [Auth] Current user:', auth.currentUser ? 'Logged in' : 'Not logged in');
      return true;
    } catch (error) {
      console.error('❌ [Auth] Error:', error);
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

  // Test Firebase Analytics
  async testAnalytics() {
    try {
      console.log('📊 [Analytics] Testing Analytics...');
      
      // Analytics only on web/supported platforms
      if (typeof window === 'undefined') {
        console.log('📊 [Analytics] Analytics not available on this platform');
        return true;
      }
      
      // Lazy load analytics
      const { getAnalytics, logEvent } = await import('firebase/analytics');
      const analytics = getAnalytics(this.app);
      
      // Log a test event
      logEvent(analytics, 'firebase_test', {
        test_parameter: 'mobile_app_test',
        timestamp: new Date().toISOString()
      });
      
      console.log('✅ [Analytics] Test event logged successfully');
      return true;
    } catch (error) {
      console.error('❌ [Analytics] Error:', error);
      console.log('📊 [Analytics] Analytics might not be available on this platform');
      return true; // Don't fail the test for analytics
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
      const app = this.app || this.initializeFirebase();
      const { getAuth } = await import('firebase/auth');
      return getAuth(app);
    } catch (error) {
      console.error('❌ [Firebase] Error getting Auth:', error);
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

  async getAnalytics() {
    try {
      if (typeof window === 'undefined') return null;
      
      const app = this.app || this.initializeFirebase();
      const { getAnalytics } = await import('firebase/analytics');
      return getAnalytics(app);
    } catch (error) {
      console.error('❌ [Firebase] Error getting Analytics:', error);
      return null;
    }
  }
}

export default new FirebaseService();