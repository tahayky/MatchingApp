import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filename);

    if (!publicUrlData.publicUrl) {
      return {
        success: false,
        error: 'Failed to get public URL for uploaded photo'
      };
    }

    return {
      success: true,
      url: publicUrlData.publicUrl,
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
 * Get photo URL from filename
 */
export const getPhotoUrl = (filename: string): string => {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);
  
  return data.publicUrl;
};