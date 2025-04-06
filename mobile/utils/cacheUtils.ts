import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys
const CACHE_KEYS = {
  PROFILES: 'cached_profiles',
  MATCHES: 'cached_matches',
  LAST_FETCH_PROFILES: 'last_fetch_profiles',
  LAST_FETCH_MATCHES: 'last_fetch_matches',
};

// Default cache expiration time (15 minutes)
const DEFAULT_CACHE_EXPIRATION = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Save data to the cache
 * @param key The cache key
 * @param data The data to cache
 */
export const saveToCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(data);
    await AsyncStorage.setItem(key, jsonValue);
    
    // Store timestamp of when the data was cached
    const timestamp = new Date().getTime();
    await AsyncStorage.setItem(`${key}_timestamp`, timestamp.toString());
    
    console.log(`Veri önbelleğe kaydedildi: ${key}`);
  } catch (error) {
    console.error(`Önbellek kaydetme hatası (${key}):`, error);
  }
};

/**
 * Get data from cache
 * @param key The cache key
 * @param expirationTime Time in milliseconds after which cache is considered stale
 * @returns The cached data or null if not found or expired
 */
export const getFromCache = async <T>(
  key: string, 
  expirationTime = DEFAULT_CACHE_EXPIRATION
): Promise<T | null> => {
  try {
    // Check when the data was cached
    const timestampStr = await AsyncStorage.getItem(`${key}_timestamp`);
    if (!timestampStr) return null;
    
    const timestamp = parseInt(timestampStr, 10);
    const now = new Date().getTime();
    
    // If cache is expired, return null
    if (now - timestamp > expirationTime) {
      console.log(`Önbellek süresi doldu: ${key}`);
      return null;
    }
    
    // Get cached data
    const jsonValue = await AsyncStorage.getItem(key);
    if (jsonValue === null) return null;
    
    const data = JSON.parse(jsonValue) as T;
    console.log(`Veri önbellekten alındı: ${key}`);
    return data;
  } catch (error) {
    console.error(`Önbellekten okuma hatası (${key}):`, error);
    return null;
  }
};

/**
 * Clear an item from cache
 * @param key The cache key to clear
 */
export const clearCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
    await AsyncStorage.removeItem(`${key}_timestamp`);
    console.log(`Önbellek temizlendi: ${key}`);
  } catch (error) {
    console.error(`Önbellek temizleme hatası (${key}):`, error);
  }
};

/**
 * Clear all cache items (profiles and matches)
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = Object.values(CACHE_KEYS);
    const timestampKeys = keys.map(key => `${key}_timestamp`);
    
    await AsyncStorage.multiRemove([...keys, ...timestampKeys]);
    console.log('Tüm önbellek temizlendi');
  } catch (error) {
    console.error('Tüm önbelleği temizleme hatası:', error);
  }
};

/**
 * Simple cache for profiles
 */
export const profileCache = {
  save: (profiles: any[]) => saveToCache(CACHE_KEYS.PROFILES, profiles),
  get: () => getFromCache<any[]>(CACHE_KEYS.PROFILES),
  clear: () => clearCache(CACHE_KEYS.PROFILES),
  updateLastFetch: () => saveToCache(CACHE_KEYS.LAST_FETCH_PROFILES, new Date().getTime()),
  getLastFetch: () => getFromCache<number>(CACHE_KEYS.LAST_FETCH_PROFILES),
};

/**
 * Simple cache for matches
 */
export const matchCache = {
  save: (matches: any[]) => saveToCache(CACHE_KEYS.MATCHES, matches),
  get: () => getFromCache<any[]>(CACHE_KEYS.MATCHES),
  clear: () => clearCache(CACHE_KEYS.MATCHES),
  updateLastFetch: () => saveToCache(CACHE_KEYS.LAST_FETCH_MATCHES, new Date().getTime()),
  getLastFetch: () => getFromCache<number>(CACHE_KEYS.LAST_FETCH_MATCHES),
};
