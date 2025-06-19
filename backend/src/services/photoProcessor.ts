import { createClient } from '@supabase/supabase-js';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client with SERVICE ROLE for private bucket access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️ SUPABASE_URL ve SUPABASE_SERVICE_ROLE environment variable\'ları eksik!');
  console.error('Private bucket erişimi için SERVICE ROLE key gerekli!');
  console.error('Lütfen environment\'a ekleyin:');
  console.error('SUPABASE_URL=https://yourproject.supabase.co');
  console.error('SUPABASE_SERVICE_ROLE=your-service-role-key-here');
  throw new Error('Supabase SERVICE ROLE configuration missing. Private bucket requires service key.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ Supabase client initialized with SERVICE ROLE for private bucket access');

// Redis client setup
let redisClient: RedisClientType | undefined;
let isConnecting = false;

const initializeRedis = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[Photo Cache] REDIS_URL not found, photo URL caching disabled');
    return;
  }

  // Eğer zaten bağlıysa veya bağlanmaya çalışıyorsa tekrar deneme
  if (redisClient?.isOpen || isConnecting) {
    return;
  }

  try {
    isConnecting = true;
    
    if (!redisClient) {
      console.log('[Photo Cache] Initializing Redis connection...');
      redisClient = createRedisClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000
        }
      });

      redisClient.on('error', (err) => {
        // Upstash Redis belirli komutları desteklemiyor (bu normal)
        if (err.message.includes('Command is not available')) {
          if (err.message.includes('CLIENT SETINFO') || err.message.includes('CLIENT GETNAME')) {
            // Bu hatayı hiç loglamayalım - çok normal
            return;
          }
          console.warn('[Photo Cache] ⚠️  Upstash desteklenmeyen komut:', err.message);
          return;
        }
        
        // Gerçek bağlantı hataları
        console.error('[Photo Cache] ❌ Redis bağlantı hatası:', err);
        redisClient = undefined;
        isConnecting = false;
      });

      redisClient.on('connect', () => {
        console.log('[Photo Cache] ✅ Redis connected to Upstash successfully');
        isConnecting = false;
      });

      redisClient.on('disconnect', () => {
        console.log('[Photo Cache] 🔌 Redis disconnected');
        isConnecting = false;
      });

      await redisClient.connect();
    }
  } catch (error) {
    console.error('[Photo Cache] Redis connection failed:', error);
    redisClient = undefined;
    isConnecting = false;
  }
};

// Redis will be initialized lazily when first needed
// No automatic initialization on module load to prevent repeated connections

// Constants
const STORAGE_BUCKET = 'user-photos';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_WIDTH = 1080;
const MAX_HEIGHT = 1080;
const QUALITY = 85;

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  filename?: string;
}

export interface PhotoValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate uploaded photo file
 */
export const validatePhoto = (file: Express.Multer.File): PhotoValidationResult => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    };
  }

  // Check if file buffer exists
  if (!file.buffer) {
    return {
      isValid: false,
      error: 'File buffer is empty'
    };
  }

  return { isValid: true };
};

/**
 * Process and optimize photo
 */
export const processPhoto = async (buffer: Buffer): Promise<Buffer> => {
  try {
    // Process image with sharp
    const processedBuffer = await sharp(buffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: QUALITY,
        progressive: true
      })
      .toBuffer();

    return processedBuffer;
  } catch (error) {
    console.error('Error processing photo:', error);
    throw new Error('Failed to process photo');
  }
};

/**
 * Upload photo to Supabase Storage
 */
export const uploadToSupabase = async (
  buffer: Buffer,
  userId: string,
  originalName: string
): Promise<PhotoUploadResult> => {
  try {
    // Generate unique filename
    const fileExtension = path.extname(originalName) || '.jpg';
    const filename = `${userId}/${uuidv4()}${fileExtension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return {
        success: false,
        error: 'Failed to upload photo to storage'
      };
    }

    // Private bucket için signed URL oluştur (5 dakika geçerli)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filename, 5 * 60); // 5 dakika

    if (urlError || !signedUrlData?.signedUrl) {
      console.error('Signed URL creation error:', urlError);
      return {
        success: false,
        error: 'Failed to get signed URL for uploaded photo'
      };
    }

    return {
      success: true,
      url: signedUrlData.signedUrl,
      filename: filename
    };
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return {
      success: false,
      error: 'Internal server error during upload'
    };
  }
};

/**
 * Delete photo from Supabase Storage
 */
export const deleteFromSupabase = async (filename: string): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filename]);

    if (error) {
      console.error('Supabase delete error:', error);
      return false;
    }

    // Fotoğraf silindiğinde cache'i de temizle
    await clearPhotoCache(filename);

    return true;
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    return false;
  }
};

/**
 * Complete photo upload process
 */
export const uploadPhoto = async (
  file: Express.Multer.File,
  userId: string
): Promise<PhotoUploadResult> => {
  try {
    // Validate photo
    const validation = validatePhoto(file);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }

    // Process photo
    const processedBuffer = await processPhoto(file.buffer);

    // Upload to Supabase
    const uploadResult = await uploadToSupabase(processedBuffer, userId, file.originalname);

    return uploadResult;
  } catch (error) {
    console.error('Error in uploadPhoto:', error);
    return {
      success: false,
      error: 'Failed to upload photo'
    };
  }
};

/**
 * Configure multer for memory storage
 */
export const photoUploadConfig = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 6 // Maximum 6 photos per upload
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  }
});

/**
 * Batch photo upload
 */
export const uploadMultiplePhotos = async (
  files: Express.Multer.File[],
  userId: string
): Promise<PhotoUploadResult[]> => {
  const results: PhotoUploadResult[] = [];

  for (const file of files) {
    const result = await uploadPhoto(file, userId);
    results.push(result);
  }

  return results;
};

/**
 * Check if Supabase signed URL is expired
 */
const isUrlExpired = (signedUrl: string): boolean => {
  try {
    const url = new URL(signedUrl);
    const expParam = url.searchParams.get('exp');
    
    if (!expParam) {
      console.log('[Photo Cache] No exp parameter found in URL, assuming expired');
      return true; // Eğer exp parametresi yoksa expire kabul et
    }
    
    const expTimestamp = parseInt(expParam, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    // 30 saniye güvenlik payı ekle
    const isExpired = (expTimestamp - 30) <= currentTimestamp;
    
    if (isExpired) {
      console.log(`[Photo Cache] URL expired. Exp: ${expTimestamp}, Current: ${currentTimestamp}`);
    }
    
    return isExpired;
  } catch (error) {
    console.error('[Photo Cache] Error checking URL expiration:', error);
    return true; // Hata durumunda expire kabul et
  }
};

/**
 * Get cached photo URL from Redis or create new 5-minute signed URL
 */
export const getPhotoUrl = async (filename: string): Promise<string | null> => {
  const CACHE_DURATION = (5 * 60) - 30; // 4.5 dakika (30 saniye erken expire)
  const SIGNED_URL_DURATION = 5 * 60; // 5 dakika signed URL
  const cacheKey = `photo_url:${filename}`;

  try {
    // Redis'i lazy initialize et
    await initializeRedis();
    
    // 1. Redis'te cached URL var mı kontrol et
    if (redisClient) {
      try {
        const cachedUrl = await redisClient.get(cacheKey);
        if (cachedUrl) {
          // Cache'den alınan URL'nin expire olup olmadığını kontrol et
          if (isUrlExpired(cachedUrl)) {
            console.log(`[Photo Cache] Cache HIT but URL EXPIRED for ${filename}, generating new URL`);
            await redisClient.del(cacheKey); // Expire olmuş URL'yi cache'den temizle
          } else {
            console.log(`[Photo Cache] Cache HIT for ${filename}`);
            return cachedUrl;
          }
        }
        console.log(`[Photo Cache] Cache MISS for ${filename}`);
      } catch (redisError) {
        console.error('[Photo Cache] Redis get error:', redisError);
        // Redis hatası olursa direkt Supabase'e git
      }
    }

    // 2. Yeni 5 dakikalık signed URL oluştur
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filename, SIGNED_URL_DURATION);
    
    if (error || !data?.signedUrl) {
      console.error('Error creating signed URL:', error);
      return null;
    }

    // 3. URL'yi Redis'e 5 dakika süreyle cache'le
    if (redisClient) {
      try {
        await redisClient.setEx(cacheKey, CACHE_DURATION, data.signedUrl);
        console.log(`[Photo Cache] Cached new URL for ${filename} (5 min)`);
      } catch (redisError) {
        console.error('[Photo Cache] Redis set error:', redisError);
        // Redis hatası olsa bile URL'yi döndür
      }
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting photo URL:', error);
    return null;
  }
};

/**
 * Batch get photo URLs with intelligent caching
 */
export const getMultiplePhotoUrls = async (filenames: string[]): Promise<{ [filename: string]: string | null }> => {
  const results: { [filename: string]: string | null } = {};
  
  // Redis'i lazy initialize et
  await initializeRedis();
  
  // Paralel olarak tüm URL'leri al
  const promises = filenames.map(async (filename) => {
    const url = await getPhotoUrl(filename);
    return { filename, url };
  });

  const urlResults = await Promise.all(promises);
  
  // Sonuçları organize et
  urlResults.forEach(({ filename, url }) => {
    results[filename] = url;
  });

  return results;
};

/**
 * Clear photo URL cache for specific filename
 */
export const clearPhotoCache = async (filename: string): Promise<void> => {
  // Redis'i lazy initialize et
  await initializeRedis();
  
  if (!redisClient) return;

  const cacheKey = `photo_url:${filename}`;
  try {
    await redisClient.del(cacheKey);
    console.log(`[Photo Cache] Cleared cache for ${filename}`);
  } catch (error) {
    console.error('[Photo Cache] Error clearing cache:', error);
  }
};

/**
 * Clear all photo URL caches for a user
 */
export const clearUserPhotoCache = async (userId: string): Promise<void> => {
  // Redis'i lazy initialize et
  await initializeRedis();
  
  if (!redisClient) return;

  try {
    const pattern = `photo_url:${userId}/*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[Photo Cache] Cleared ${keys.length} cached URLs for user ${userId}`);
    }
  } catch (error) {
    console.error('[Photo Cache] Error clearing user cache:', error);
  }
};

/**
 * Clean up expired URLs from cache
 */
export const cleanupExpiredPhotoCache = async (): Promise<{ cleaned: number; total: number }> => {
  await initializeRedis();
  
  if (!redisClient) {
    return { cleaned: 0, total: 0 };
  }

  try {
    const keys = await redisClient.keys('photo_url:*');
    let cleanedCount = 0;
    
    console.log(`[Photo Cache Cleanup] Checking ${keys.length} cached URLs for expiration`);
    
    for (const key of keys) {
      try {
        const cachedUrl = await redisClient.get(key);
        if (cachedUrl && isUrlExpired(cachedUrl)) {
          await redisClient.del(key);
          cleanedCount++;
          console.log(`[Photo Cache Cleanup] Removed expired URL: ${key}`);
        }
      } catch (error) {
        console.error(`[Photo Cache Cleanup] Error checking key ${key}:`, error);
        // Delete problematic keys
        await redisClient.del(key);
        cleanedCount++;
      }
    }
    
    console.log(`[Photo Cache Cleanup] Cleaned ${cleanedCount} expired URLs out of ${keys.length} total`);
    return { cleaned: cleanedCount, total: keys.length };
  } catch (error) {
    console.error('[Photo Cache Cleanup] Error during cleanup:', error);
    return { cleaned: 0, total: 0 };
  }
};

/**
 * Generate 10-minute self-view URL for user's own photos (stored in database)
 */
export const generateSelfViewUrl = async (filename: string): Promise<{ url: string; expiration: Date } | null> => {
  const SELF_VIEW_DURATION = 10 * 60; // 10 minutes

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filename, SELF_VIEW_DURATION);
    
    if (error || !data?.signedUrl) {
      console.error('Error creating self-view signed URL:', error);
      return null;
    }

    const expiration = new Date(Date.now() + (SELF_VIEW_DURATION * 1000));
    
    console.log(`[Self-View URL] Generated 10-min URL for ${filename}, expires at ${expiration.toISOString()}`);
    
    return {
      url: data.signedUrl,
      expiration
    };
  } catch (error) {
    console.error('Error generating self-view URL:', error);
    return null;
  }
};

/**
 * Check if self-view URL is expired
 */
export const isSelfViewUrlExpired = (expiration: Date): boolean => {
  const now = new Date();
  const isExpired = now >= expiration;
  
  if (isExpired) {
    console.log(`[Self-View URL] URL expired. Expiration: ${expiration.toISOString()}, Now: ${now.toISOString()}`);
  }
  
  return isExpired;
};

/**
 * Get or generate self-view URL for user's photo
 * If existing URL is valid, return it. Otherwise generate new one.
 */
export const getSelfViewUrl = async (
  currentUrl: string | undefined,
  expiration: Date | undefined,
  filename: string
): Promise<{ url: string; expiration: Date } | null> => {
  // If we have a valid existing URL, return it
  if (currentUrl && expiration && !isSelfViewUrlExpired(expiration)) {
    console.log(`[Self-View URL] Using existing valid URL for ${filename}`);
    return { url: currentUrl, expiration };
  }

  // Generate new URL
  console.log(`[Self-View URL] Generating new URL for ${filename} (previous expired or missing)`);
  return await generateSelfViewUrl(filename);
};