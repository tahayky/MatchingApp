console.log('[userProfile-ts.ts] Module loading...');
import express, { Request, Response, Router, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient, RedisClientType } from 'redis';
import AppSetting from '../models/AppSetting';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User, { IUser, IPhoto, IPreferences, IRejectData, ILikeData } from '../models/User';
import Match from '../models/Match';
import { protect } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: IUser;
  file?: Express.Multer.File;
}

const storage = multer.diskStorage({
  destination: function(req: AuthRequest, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    const uploadDir = 'uploads/profiles';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req: AuthRequest, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    if (!req.user || !req.user._id) {
      return cb(new Error('User not authenticated for filename generation'), '');
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user._id.toString()}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed') as any);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const router: Router = express.Router();

router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) { return res.status(401).json({ success: false, message: 'Not authorized, user not found' }); }
    const { bio, coordinates, city, country, interests, occupation, education, height, ageRangeMin, ageRangeMax, maxDistance } = req.body;
    const userToUpdate = await User.findById(req.user._id);
    if (!userToUpdate) { return res.status(404).json({ success: false, message: 'User not found' }); }
    if (bio !== undefined) userToUpdate.bio = bio;
    userToUpdate.location = {
        type: 'Point',
        coordinates: coordinates || userToUpdate.location?.coordinates || [0,0] as [number, number],
        city: city || userToUpdate.location?.city,
        country: country || userToUpdate.location?.country
    };
    if (interests !== undefined) { userToUpdate.interests = Array.isArray(interests) ? interests : (interests as string).split(',').map((interest: string) => interest.trim()); }
    if (occupation !== undefined) userToUpdate.occupation = occupation;
    if (education !== undefined) userToUpdate.education = education;
    if (height !== undefined) userToUpdate.height = height;
    userToUpdate.preferences = {
        ageRange: {
            min: ageRangeMin !== undefined ? parseInt(ageRangeMin, 10) : (userToUpdate.preferences?.ageRange?.min ?? 18),
            max: ageRangeMax !== undefined ? parseInt(ageRangeMax, 10) : (userToUpdate.preferences?.ageRange?.max ?? 100)
        },
        distance: maxDistance !== undefined ? parseInt(maxDistance, 10) : (userToUpdate.preferences?.distance ?? 50)
    };
    userToUpdate.photos = userToUpdate.photos || [];
    userToUpdate.likedBy = userToUpdate.likedBy || [];
    userToUpdate.rejected = userToUpdate.rejected || [];
    userToUpdate.lastActive = new Date();
    userToUpdate.isProfileComplete = true;
    await userToUpdate.save();
    res.json({ success: true, user: userToUpdate });
  } catch (error: unknown) {
    console.error('Profile update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: 'Server error during profile update', error: errorMessage });
  }
});

router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) { return res.status(401).json({ success: false, message: 'Not authorized, user not found'}); }
    const userProfile = await User.findById(req.user._id).select('-password');
    if (!userProfile) { return res.status(404).json({ success: false, message: 'User profile not found. Please complete your profile.'});}
    res.json({ success: true, user: userProfile });
  } catch (error: unknown) {
    console.error('Get my profile error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: 'Server error fetching profile', error: errorMessage });
  }
});

router.post('/photos', protect, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) { return res.status(401).json({ success: false, message: 'Not authorized, user not found' });}
    if (!req.file) { return res.status(400).json({ success: false, message: 'No file uploaded' });}
    const user = await User.findById(req.user._id);
    if (!user) {
      if (req.file?.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting orphaned file:", err); });
      return res.status(404).json({ success: false, message: 'User not found. Please complete your profile first.' });
    }
    const photoUrl = `/${req.file.path.replace(/\\/g, '/')}`;
    user.photos = user.photos || [];
    const isMain = user.photos.length === 0;
    user.photos.push({ url: photoUrl, isMain } as IPhoto);
    await user.save();
    res.json({ success: true, photo: { url: photoUrl, isMain }, photos: user.photos });
  } catch (error: unknown) {
    console.error('Upload photo error:', error);
    if (req.file?.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting file after DB error:", err); });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: 'Server error uploading photo', error: errorMessage });
  }
});

router.put('/photos/:photoId/main', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) { return res.status(401).json({ success: false, message: 'Not authorized, user not found' });}
    const { photoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(photoId)) { return res.status(400).json({ success: false, message: 'Invalid photo ID' });}
    const user = await User.findById(req.user._id);
    if (!user) { return res.status(404).json({ success: false, message: 'User not found' });}
    user.photos = user.photos || [];
    let photoFound = false;
    user.photos.forEach((photo: IPhoto) => {
      if (photo._id && photo._id.toString() === photoId) {
        photo.isMain = true;
        photoFound = true;
      } else {
        photo.isMain = false;
      }
    });
    if (!photoFound) { return res.status(404).json({ success: false, message: 'Photo not found in user profile' });}
    await user.save();
    res.json({ success: true, message: 'Main photo updated successfully', photos: user.photos });
  } catch (error: unknown) {
    console.error('Set main photo error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: 'Server error setting main photo', error: errorMessage });
  }
});

// --- Settings for Discover Profiles ---
const DEFAULT_DISCOVER_RATE_LIMIT_CONFIG = {
  windowMs: 10 * 1000, 
  max: 5, 
  message: 'Too many discovery requests, please try again after 10 seconds.',
};
const DISCOVER_RATE_LIMIT_KEY = 'discoverRateLimit';
const PROFILES_PER_PAGE_KEY = 'discoverProfilesPerPage'; // Key for profiles per page setting
const DEFAULT_PROFILES_PER_PAGE = 5; // Default profiles per page

let currentProfilesPerPage: number = DEFAULT_PROFILES_PER_PAGE; // Global variable for profiles per page

// Module-level variables for rate limiting
let currentWindowMsRateLimit: number = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.windowMs;
let currentMaxRateLimit: number = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.max;
let currentMessageRateLimit: string = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;
let discoverLimiterInstance: ReturnType<typeof rateLimit> | undefined; // To hold the rate-limit middleware
let redisClient: RedisClientType | undefined;
let redisStoreInstance: RedisStore | undefined;

// Function to update the "profiles per page" setting from DB
export async function updateProfilesPerPageSetting() {
  try {
    console.log(`[ProfilesPerPage UPDATE] Attempting to find AppSetting with key: ${PROFILES_PER_PAGE_KEY}`);
    const dbSetting = await AppSetting.findOne({ key: PROFILES_PER_PAGE_KEY });
    // Expecting the setting to be stored as { value: { count: NUMBER } }
    if (dbSetting && dbSetting.value && typeof dbSetting.value.count === 'number' && dbSetting.value.count > 0) {
      currentProfilesPerPage = dbSetting.value.count;
      console.log(`[ProfilesPerPage UPDATE] Successfully applied DB config: ${currentProfilesPerPage} profiles per page.`);
    } else {
      currentProfilesPerPage = DEFAULT_PROFILES_PER_PAGE;
      if (dbSetting && dbSetting.value) {
        console.log(`[ProfilesPerPage UPDATE] DB setting found but 'value.count' is invalid or not a positive number. Value:`, JSON.stringify(dbSetting.value));
      } else if (dbSetting) {
        console.log(`[ProfilesPerPage UPDATE] DB setting found but 'value' is missing.`);
      } else {
        console.log(`[ProfilesPerPage UPDATE] No DB config found for key '${PROFILES_PER_PAGE_KEY}'.`);
      }
      console.log(`[ProfilesPerPage UPDATE] Using default: ${currentProfilesPerPage} profiles per page.`);
    }
  } catch (error) {
    currentProfilesPerPage = DEFAULT_PROFILES_PER_PAGE;
    console.error('[ProfilesPerPage UPDATE] Error fetching profiles per page setting from DB, using defaults:', error);
    console.log(`[ProfilesPerPage UPDATE] Default due to error: ${currentProfilesPerPage} profiles per page.`);
  }
}

// Function to update the rate limiter settings from DB
export async function updateDiscoverLimiter() {
  console.log('[RateLimiter Setup with Redis] Entered updateDiscoverLimiter function.');

  let newWindowMs = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.windowMs;
  let newMax = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.max;
  let newMessageString = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;

  try {
    console.log(`[RateLimiter Setup] Attempting to find AppSetting with key: ${DISCOVER_RATE_LIMIT_KEY}`);
    const dbSetting = await AppSetting.findOne({ key: DISCOVER_RATE_LIMIT_KEY });
    if (dbSetting) {
      console.log(`[RateLimiter Setup] Found DB setting. Value:`, JSON.stringify(dbSetting.value, null, 2));
      if (dbSetting.value && typeof dbSetting.value.windowMs === 'number' && typeof dbSetting.value.max === 'number') {
        newWindowMs = dbSetting.value.windowMs;
        newMax = dbSetting.value.max;
        if (dbSetting.value.message && typeof dbSetting.value.message === 'string') {
          newMessageString = dbSetting.value.message;
        }
        console.log(`[RateLimiter Setup] Successfully read DB config for /discover: ${newMax} successful req / ${newWindowMs / 1000}s.`);
      } else {
        console.log(`[RateLimiter Setup] DB setting found but 'value' or 'windowMs'/'max' fields are invalid. Using defaults.`);
      }
    } else {
      console.log(`[RateLimiter Setup] No DB config found for key '${DISCOVER_RATE_LIMIT_KEY}'. Using defaults.`);
    }
  } catch (error) {
    console.error('[RateLimiter Setup] Error fetching discover rate limit settings from DB, using defaults:', error);
  }

  currentWindowMsRateLimit = newWindowMs;
  currentMaxRateLimit = newMax;
  currentMessageRateLimit = newMessageString || DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;

  const redisUrl = process.env.REDIS_URL;
  if (!redisClient && redisUrl) {
    try {
      console.log(`[RateLimiter Setup with Redis] Attempting to create Redis client with URL: ${redisUrl}`);
      const client = createClient({
        url: redisUrl,
        disableClientInfo: true // Add this option for Upstash compatibility
      });
      
      client.on('error', (err) => {
        console.error('[RateLimiter Setup with Redis] Redis Client Error:', err);
        redisClient = undefined; // Ensure client is marked as unusable
        redisStoreInstance = undefined;
        discoverLimiterInstance = undefined; // Also disable limiter if Redis fails
      });

      await client.connect();
      console.log('[RateLimiter Setup with Redis] Redis client connected successfully.');
      redisClient = client as RedisClientType; // Cast to RedisClientType after connect
      
      // Create RedisStore instance
      // The 'sendCommand' option is crucial for compatibility with redis v4+
      redisStoreInstance = new RedisStore({
        sendCommand: (...args: string[]) => redisClient!.sendCommand(args),
        prefix: 'rlDiscover:', // Optional prefix for keys in Redis
      });
      console.log('[RateLimiter Setup with Redis] RedisStore instance CREATED successfully.');

    } catch (err) {
      console.error('[RateLimiter Setup with Redis] Failed to connect to Redis or create store:', err);
      redisClient = undefined;
      redisStoreInstance = undefined;
    }
  } else if (!redisUrl) {
    console.warn('[RateLimiter Setup with Redis] REDIS_URL not defined. Rate limiting will be bypassed or use memory store.');
    redisClient = undefined;
    redisStoreInstance = undefined;
  }


  if (redisStoreInstance) {
    console.log(`[RateLimiter Setup with Redis] Creating/Updating express-rate-limit middleware instance with RedisStore.`);
    discoverLimiterInstance = rateLimit({
        store: redisStoreInstance,
        windowMs: currentWindowMsRateLimit,
        max: currentMaxRateLimit, // Max number of successful requests
        message: { success: false, message: currentMessageRateLimit },
        skipFailedRequests: true, // *** This is the key change: only count 2xx responses ***
        keyGenerator: (req: Request) => {
          const authReq = req as AuthRequest;
          return authReq.user?._id?.toString() || authReq.ip;
        },
        handler: (req: Request, res: Response, next: NextFunction, optionsUsed: any) => { // No need for async here if not awaiting store.resetTime
          const authReq = req as AuthRequest;
          const key = authReq.user?._id?.toString() || authReq.ip;
          
          // optionsUsed.resetTime should be the Date object for when the limit will be reset
          const calculatedResetTime = optionsUsed.resetTime instanceof Date ? optionsUsed.resetTime.toISOString() : 'options.resetTime not a Date object or not available';

          console.warn(
            `[RATE LIMIT EXCEEDED with Redis] For /discover. Key: ${key}. Max successful: ${optionsUsed.max}. Window: ${optionsUsed.windowMs / 1000}s. ` +
            `Calculated ResetTime (by express-rate-limit): ${calculatedResetTime}.`
          );
          // The store.resetTime method might not be standard or needed if express-rate-limit handles it with Redis's native TTL
          res.status(optionsUsed.statusCode || 429).json(optionsUsed.message);
        },
        standardHeaders: true,
        legacyHeaders: false,
      });
    console.log(`[RateLimiter Setup with Redis] express-rate-limit middleware configured with RedisStore. Max: ${currentMaxRateLimit}, Window: ${currentWindowMsRateLimit / 1000}s.`);
  } else {
    console.error('[RateLimiter Setup with Redis] RedisStore instance is not available. Rate limiting will be bypassed.');
    discoverLimiterInstance = undefined;
  }
  console.log('[RateLimiter Setup with Redis] Exiting updateDiscoverLimiter function.');
}

// Initial calls to load settings at startup
console.log('[userProfile-ts.ts] Setting up initial calls to updaters...');
(async () => {
  try {
    console.log('[userProfile-ts.ts] EXECUTING initial call to updateDiscoverLimiter()...');
    await updateDiscoverLimiter();
    console.log('[userProfile-ts.ts] Initial updateDiscoverLimiter() call successfully completed.');
  } catch (error) {
    console.error("[userProfile-ts.ts] CRITICAL ERROR during initial execution of updateDiscoverLimiter():", error);
  }
  try {
    console.log('[userProfile-ts.ts] EXECUTING initial call to updateProfilesPerPageSetting()...');
    await updateProfilesPerPageSetting(); // Load profiles per page setting
    console.log('[userProfile-ts.ts] Initial updateProfilesPerPageSetting() call successfully completed.');
  } catch (error) {
    console.error("[userProfile-ts.ts] CRITICAL ERROR during initial execution of updateProfilesPerPageSetting():", error);
  }
})();

router.get('/discover', protect, (req: Request, res: Response, next: NextFunction) => {
  // Apply the discoverLimiterInstance middleware if it's defined
  if (discoverLimiterInstance) {
    console.log(`[${new Date().toISOString()}] [DISCOVER PRE-HANDLER] Applying discoverLimiterInstance.`);
    discoverLimiterInstance(req, res, next);
  } else {
    // If limiter is not set up (e.g., MONGODB_URI missing), bypass rate limiting
    console.warn(`[${new Date().toISOString()}] [DISCOVER PRE-HANDLER] discoverLimiterInstance is not defined. Bypassing rate limit for /discover.`);
    next();
  }
}, async (req: AuthRequest, res: Response) => {
  // Main route handler logic starts here, after rate limiter (if any) has passed
  const requestTimestampStart = new Date().toISOString();
  const authReq = req as AuthRequest;
  console.log(`[${requestTimestampStart}] [DISCOVER HANDLER] UserID: ${authReq.user?._id}, IP: ${authReq.ip}, Page: ${req.query.page}`);

  try {
    const page = parseInt(req.query.page as string) || 1;
    const queryLimit = currentProfilesPerPage;

    console.log(`[${new Date().toISOString()}] [DISCOVER HANDLER] Processing. UserID: ${authReq.user?._id}. Page: ${page}, Limit: ${queryLimit}`);

    if (!authReq.user || !authReq.user._id) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }
    const currentUser = await User.findById(authReq.user._id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Current user not found' });
    }
    currentUser.location = currentUser.location || { type: 'Point', coordinates: [0,0] as [number, number], city: 'Unknown', country: 'Unknown' };
    currentUser.preferences = currentUser.preferences || { ageRange: {min: 18, max: 100}, distance: 50};
    currentUser.rejected = currentUser.rejected || [];
    currentUser.likedBy = currentUser.likedBy || [];
    currentUser.viewedProfiles = currentUser.viewedProfiles || [];

    const interestedInGenders = currentUser.interestedIn || [];
    const query: mongoose.FilterQuery<IUser> = {
      _id: { $ne: currentUser._id },
      gender: { $in: interestedInGenders },
      isProfileComplete: true
    };
    if (currentUser.location && currentUser.location.coordinates && (currentUser.location.coordinates[0] !== 0 || currentUser.location.coordinates[1] !== 0)) {
      const maxDistance = currentUser.preferences?.distance || 50;
      query.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: currentUser.location.coordinates },
          $maxDistance: maxDistance * 1000
        }
      };
    }
    if (currentUser.preferences?.ageRange) {
        const minAge = currentUser.preferences.ageRange.min;
        const maxAge = currentUser.preferences.ageRange.max;
        const today = new Date();
        const minBirthDate = new Date(today.getFullYear() - maxAge -1, today.getMonth(), today.getDate());
        const maxBirthDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
        query.dateOfBirth = { $gte: minBirthDate, $lte: maxBirthDate };
    }

    const usersToExclude: mongoose.Types.ObjectId[] = [];
    // rejected listesi artık kullanılmıyor, Match tablosundan pass action'ları kontrol ediliyor
    // Hem like hem de pass edilmiş profilleri hariç tut
    const allMatches = await Match.find({ user: currentUser._id }).select('targetUser action');
    console.log(`[DISCOVER PROFILES] Match records for user ${currentUser._id}:`);
    
    if (allMatches.length > 0) {
      // Debug için action'lara göre grupla
      const likeCount = allMatches.filter(m => m.action === 'like').length;
      const passCount = allMatches.filter(m => m.action === 'pass').length;
      
      console.log(`[DISCOVER PROFILES] Total matches: ${allMatches.length} (Likes: ${likeCount}, Passes: ${passCount})`);
      
      allMatches.forEach(match => {
        if (!usersToExclude.find(id => id.equals(match.targetUser))) {
          usersToExclude.push(match.targetUser);
        }
      });
      
      console.log(`[DISCOVER PROFILES] Unique users to exclude: ${usersToExclude.length}`);
    }
    const existingMatches = await Match.find({
        $or: [
            { user: currentUser._id, targetUser: { $in: usersToExclude }, isMatch: true },
            { targetUser: currentUser._id, user: { $in: usersToExclude }, isMatch: true }
        ]
    }).select('user targetUser');
    existingMatches.forEach(match => {
        if (match.user.toString() !== currentUser._id.toString() && !usersToExclude.find(id => id.equals(match.user))) {
            usersToExclude.push(match.user);
        }
        if (match.targetUser.toString() !== currentUser._id.toString() && !usersToExclude.find(id => id.equals(match.targetUser))) {
            usersToExclude.push(match.targetUser);
        }
    });

    // viewedProfiles artık discover'da filtreleme için KULLANILMAYACAK
    // Sadece swipe edilenler (liked/rejected) hariç tutulacak
    // Bu sayede pagination düzgün çalışacak
    console.log(`[DISCOVER PROFILES] viewedProfiles count: ${currentUser.viewedProfiles?.length || 0} - NOT excluding from results`);

    if (usersToExclude.length > 0) {
      query._id = {
          $nin: usersToExclude.filter(id => mongoose.Types.ObjectId.isValid(id)),
          $ne: currentUser._id
      };
    }
    
    // Önce tüm uygun profilleri say (exclusion'lardan önce)
    const queryWithoutExclusions = { ...query };
    delete queryWithoutExclusions._id; // Exclusion'ları kaldır
    queryWithoutExclusions._id = { $ne: currentUser._id }; // Sadece kendini hariç tut
    
    const totalProfilesBeforeExclusions = await User.countDocuments(queryWithoutExclusions);
    const totalMatchingProfiles = await User.countDocuments(query);
    
    console.log(`[DISCOVER PROFILES] Total profiles before exclusions: ${totalProfilesBeforeExclusions}`);
    console.log(`[DISCOVER PROFILES] Total profiles after exclusions: ${totalMatchingProfiles}`);

    console.log(`[DISCOVER PROFILES] User ID: ${currentUser._id}`);
    console.log(`[DISCOVER PROFILES] User Preferences: Age ${currentUser.preferences?.ageRange?.min}-${currentUser.preferences?.ageRange?.max}, Dist: ${currentUser.preferences?.distance}km`);
    console.log(`[DISCOVER PROFILES] User InterestedIn: ${currentUser.interestedIn?.join(', ')}`);
    console.log(`[DISCOVER PROFILES] Query to MongoDB: ${JSON.stringify(query, null, 2)}`);
    console.log(`[DISCOVER PROFILES] Users to Exclude (${usersToExclude.length}): ${usersToExclude.map(id => id.toString()).join(', ')}`);

    // Sadece limit kadar profil getir (skip kullanmıyoruz çünkü zaten exclude ediyoruz)
    const potentialMatches = await User.find(query)
      .select('_id name dateOfBirth gender photos bio location interests occupation education')
      .sort({ createdAt: -1 }) // Tutarlı sıralama için
      .limit(queryLimit);
    
    console.log(`[DISCOVER PROFILES] Found ${potentialMatches.length} profiles (limit: ${queryLimit})`);
    console.log(`[DISCOVER PROFILES] These profiles are NOT in the excluded list of ${usersToExclude.length} users`);

    const formattedUsers = potentialMatches.map(u => {
      let age;
      if (u.dateOfBirth) {
        const birthDate = new Date(u.dateOfBirth);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
      return {
        _id: u._id, name: u.name, gender: u.gender, age: age, photos: u.photos, bio: u.bio,
        location: u.location ? { city: u.location.city, country: u.location.country } : undefined,
        interests: u.interests, occupation: u.occupation, education: u.education,
      };
    });

    // viewedProfiles'a ekleme YAPILMAYACAK - sadece swipe edilenler matches-ts.ts'de eklenecek
    // Bu sayede pagination düzgün çalışacak ve "profil kalmadı" hatası düzelecek
    console.log(`[DISCOVER PROFILES] Returned ${potentialMatches.length} profiles. viewedProfiles NOT updated here.`);

    // Removed manual rate limit increment logic.
    // express-rate-limit with skipFailedRequests: true will handle counting successful (2xx) responses.

    console.log(`[${new Date().toISOString()}] [DISCOVER REQ SUCCESS] UserID: ${authReq.user?._id}. Responding with ${formattedUsers.length} profiles.`);
    return res.json({
      success: true,
      profiles: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMatchingProfiles / queryLimit),
        totalProfiles: totalMatchingProfiles,
        limit: queryLimit
      }
    });

  } catch (error: unknown) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[${errorTimestamp}] [DISCOVER REQ ERROR] UserID: ${authReq.user?._id}, IP: ${authReq.ip}. Error:`, error);
    // Pass to the main error handler for consistent error response
    // Make sure 'next' is available in the function signature if you want to use it.
    // For now, sending a generic error response directly.
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error during discovery';
    if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Server error processing discovery request', error: errorMessage });
    }
  }
});

router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Profiles test route is working!' });
});

// Debug endpoint - Match kayıtlarını kontrol et
router.get('/debug/matches', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const userMatches = await Match.find({ user: req.user._id }).populate('targetUser', 'name');
    const matchedWithUser = await Match.find({ targetUser: req.user._id }).populate('user', 'name');
    
    res.json({
      success: true,
      userMatches: userMatches.length,
      matchedWithUser: matchedWithUser.length,
      details: {
        myActions: userMatches.map(m => ({
          targetUser: m.targetUser,
          action: m.action,
          isMatch: m.isMatch,
          createdAt: m.createdAt
        })),
        othersActions: matchedWithUser.map(m => ({
          user: m.user,
          action: m.action,
          isMatch: m.isMatch,
          createdAt: m.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Debug matches error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
