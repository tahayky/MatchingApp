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

const initializeRedis = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[Photo Cache] REDIS_URL not found, photo URL caching disabled');
    return;
  }

  try {
    if (!redisClient) {
      redisClient = createRedisClient({
        url: redisUrl,
        socket: {
          connectTimeout: 10000,
          reconnectDelay: 1000
        },
        // Upstash Redis uyumluluğu için
        disableOfflineQueue: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3
      });

      redisClient.on('error', (err) => {
        console.warn('[Photo Cache] Redis Warning (Upstash uyumluluk):', err.message);
        // Upstash uyumluluk hataları için client'ı kapatma
        if (err.message.includes('Command is not available') || err.message.includes('CLIENT SETINFO')) {
          console.log('[Photo Cache] Ignoring Upstash compatibility warning');
          return;
        }
        redisClient = undefined;
      });

      redisClient.on('connect', () => {
        console.log('[Photo Cache] Redis connected to Upstash successfully');
      });

      await redisClient.connect();
    }
  } catch (error) {
    console.error('[Photo Cache] Redis connection failed:', error);
    redisClient = undefined;
  }
};

// Initialize Redis on module load
initializeRedis();

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
 * Get cached photo URL from Redis or create new 5-minute signed URL
 */
export const getPhotoUrl = async (filename: string): Promise<string | null> => {
  const CACHE_DURATION = (5 * 60) - 30; // 4.5 dakika (30 saniye erken expire)
  const SIGNED_URL_DURATION = 5 * 60; // 5 dakika signed URL
  const cacheKey = `photo_url:${filename}`;

  try {
    // 1. Redis'te cached URL var mı kontrol et
    if (redisClient) {
      try {
        const cachedUrl = await redisClient.get(cacheKey);
        if (cachedUrl) {
          console.log(`[Photo Cache] Cache HIT for ${filename}`);
          return cachedUrl;
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