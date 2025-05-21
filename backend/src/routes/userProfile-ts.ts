console.log('[userProfile-ts.ts] Module loading...');
import express, { Request, Response, Router, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import MongoStore from 'rate-limit-mongo'; // Import MongoStore
import AppSetting from '../models/AppSetting';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User, { IUser, IPhoto, IPreferences, IRejectData, ILikeData } from '../models/User';
import Match from '../models/Match';
import { protect } from '../middleware/auth';

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser;
  file?: Express.Multer.File;
}

// Configure multer for file uploads
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const router: Router = express.Router();

// Profile Create/Update Route
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }
    const { bio, coordinates, city, country, interests, occupation, education, height, ageRangeMin, ageRangeMax, maxDistance } = req.body;
    const userToUpdate = await User.findById(req.user._id);
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (bio !== undefined) userToUpdate.bio = bio;
    userToUpdate.location = {
        type: 'Point',
        coordinates: coordinates || userToUpdate.location?.coordinates || [0,0] as [number, number],
        city: city || userToUpdate.location?.city,
        country: country || userToUpdate.location?.country
    };
    if (interests !== undefined) {
        userToUpdate.interests = Array.isArray(interests) ? interests : (interests as string).split(',').map((interest: string) => interest.trim());
    }
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

// Get My Profile Route
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

// Upload Profile Photo Route
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

// Set Main Photo Route
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

// --- Discover Profiles Route with express-rate-limit ---
const DEFAULT_DISCOVER_RATE_LIMIT_CONFIG = {
  windowMs: 10 * 1000, 
  max: 5, 
  message: 'Too many discovery requests, please try again after 10 seconds.',
};
const DISCOVER_RATE_LIMIT_KEY = 'discoverRateLimit';

let discoverLimiterInstance: ReturnType<typeof rateLimit>; 

export async function updateDiscoverLimiter() {
  let currentWindowMs = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.windowMs;
  let currentMax = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.max;
  let currentMessageString = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;

  try {
    console.log(`[RateLimit UPDATE] Attempting to find AppSetting with key: ${DISCOVER_RATE_LIMIT_KEY}`);
    const dbSetting = await AppSetting.findOne({ key: DISCOVER_RATE_LIMIT_KEY });
    if (dbSetting) {
      console.log(`[RateLimit UPDATE] Found DB setting. Value:`, JSON.stringify(dbSetting.value, null, 2));
      if (dbSetting.value && typeof dbSetting.value.windowMs === 'number' && typeof dbSetting.value.max === 'number') {
        currentWindowMs = dbSetting.value.windowMs;
        currentMax = dbSetting.value.max;
        if (dbSetting.value.message && typeof dbSetting.value.message === 'string') {
          currentMessageString = dbSetting.value.message;
        } else if (dbSetting.value.message && typeof dbSetting.value.message === 'object' && typeof dbSetting.value.message.message === 'string') {
          currentMessageString = dbSetting.value.message.message;
        } else {
          console.log(`[RateLimit UPDATE] DB setting for message is missing or not a string, using default message string: "${DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message}"`);
          currentMessageString = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;
        }
        console.log(`[RateLimit UPDATE] Successfully applied DB config for /discover: ${currentMax} req / ${currentWindowMs / 1000}s. Message string: "${currentMessageString}"`);
      } else {
        console.log(`[RateLimit UPDATE] DB setting found but 'value' or 'windowMs'/'max' fields are invalid or not numbers. Using defaults.`);
        currentMessageString = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;
        console.log(`[RateLimit UPDATE] Default config being used: ${currentMax} req / ${currentWindowMs / 1000}s. Message string: "${currentMessageString}"`);
      }
    } else {
      console.log(`[RateLimit UPDATE] No DB config found for key '${DISCOVER_RATE_LIMIT_KEY}'. Using defaults.`);
      currentMessageString = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;
      console.log(`[RateLimit UPDATE] Default config being used: ${currentMax} req / ${currentWindowMs / 1000}s. Message string: "${currentMessageString}"`);
    }
  } catch (error) {
    console.error('[RateLimit UPDATE] Error fetching discover rate limit settings from DB, using defaults:', error);
    currentMessageString = DEFAULT_DISCOVER_RATE_LIMIT_CONFIG.message;
    console.log(`[RateLimit UPDATE] Default config due to error: ${currentMax} req / ${currentWindowMs / 1000}s. Message string: "${currentMessageString}"`);
  }

  const mongoUri = process.env.MONGODB_URI;
  let store;

  if (mongoUri) {
    console.log(`[RateLimit Instantiation] Using MongoStore for rate limiting. Collection: apiRateLimits_discover_v2`);
    store = new MongoStore({
      uri: mongoUri,
      collectionName: 'apiRateLimits_discover_v2', 
      expireTimeMs: currentWindowMs, 
      errorHandler: (err: any) => { 
        console.error('[MongoStore ERROR] Error in rate-limit-mongo store:', err);
      }
    });
  } else {
    console.warn('[RateLimit Instantiation] MONGODB_URI not defined. Falling back to MemoryStore for rate limiting. This is not recommended for production.');
  }
  
  console.log(`[RateLimit Instantiation] Creating new rateLimit instance with: max=${currentMax}, windowMs=${currentWindowMs}`);
  discoverLimiterInstance = rateLimit({
    store: store, 
    windowMs: currentWindowMs,
    max: currentMax,
    message: { success: false, message: currentMessageString }, 
    keyGenerator: (req: Request) => {
      const authReq = req as AuthRequest;
      const key = authReq.user?._id?.toString() || req.ip;
      return key;
    },
    handler: (req: Request, res: Response, next: NextFunction, optionsUsed: any) => {
      const authReq = req as AuthRequest; 
      const key = authReq.user?._id?.toString() || authReq.ip;
      const messagePayload = (typeof optionsUsed.message === 'object' && optionsUsed.message !== null)
                             ? optionsUsed.message
                             : { success: false, message: 'Too many requests, please try again later.' }; 

      console.log(`[RATE LIMIT EXCEEDED HANDLER] For /discover. Key: ${key}. UserID: ${authReq.user?._id}, IP: ${authReq.ip}. Max: ${optionsUsed.max}. WindowMs: ${optionsUsed.windowMs}.`);
      res.status(optionsUsed.statusCode || 429).json(messagePayload);
    },
    standardHeaders: true, 
    legacyHeaders: false, 
  });
}

console.log('[userProfile-ts.ts] Setting up initial call to updateDiscoverLimiter()...');
(async () => {
  try {
    console.log('[userProfile-ts.ts] EXECUTING initial call to updateDiscoverLimiter()...');
    await updateDiscoverLimiter();
    console.log('[userProfile-ts.ts] Initial updateDiscoverLimiter() call successfully completed.');
  } catch (error) {
    console.error("[userProfile-ts.ts] CRITICAL ERROR during initial execution of updateDiscoverLimiter():", error);
  }
})();

router.get('/discover', protect, (req: Request, res: Response, next: NextFunction) => { 
  const authReq = req as AuthRequest; 
  const key = authReq.user?._id?.toString() || authReq.ip;
  const requestTimestamp = new Date().toISOString();
  console.log(`[${requestTimestamp}] [RATE LIMITER PRE-INVOKE] For /discover. Key: ${key}. UserID: ${authReq.user?._id}, IP: ${authReq.ip}`);
  
  if (discoverLimiterInstance) {
    discoverLimiterInstance(req, res, (err?: any) => { 
      const afterTimestamp = new Date().toISOString();
      if (err) {
        console.error(`[${afterTimestamp}] [RATE LIMITER ERROR] Error from discoverLimiterInstance:`, err);
        return next(err); 
      }
      if (!res.headersSent) {
        console.log(`[${afterTimestamp}] [RATE LIMITER POST-INVOKE] Passed for /discover. Key: ${key}. Proceeding to main handler.`);
        next();
      } else {
        console.log(`[${afterTimestamp}] [RATE LIMITER POST-INVOKE] Response already sent for /discover (likely 429). Key: ${key}. Status: ${res.statusCode}`);
      }
    });
  } else {
    console.error(`[${new Date().toISOString()}] [RATE LIMITER CRITICAL] discoverLimiterInstance is undefined! Bypassing rate limit.`);
    next(); 
  }
}, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[${new Date().toISOString()}] [DISCOVER HANDLER] Entered main handler for /discover. UserID: ${req.user?._id}`);
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'Current user not found' });
    }
    currentUser.location = currentUser.location || { type: 'Point', coordinates: [0,0] as [number, number], city: 'Unknown', country: 'Unknown' };
    currentUser.preferences = currentUser.preferences || { ageRange: {min: 18, max: 100}, distance: 50};
    currentUser.rejected = currentUser.rejected || [];
    currentUser.likedBy = currentUser.likedBy || [];

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
    if (currentUser.rejected && currentUser.rejected.length > 0) {
      currentUser.rejected.forEach((rejection: IRejectData) => {
        if (rejection.user) { usersToExclude.push(rejection.user); }
      });
    }
    const likedMatches = await Match.find({ user: currentUser._id, action: 'like' }).select('targetUser');
    if (likedMatches.length > 0) {
      likedMatches.forEach(match => { usersToExclude.push(match.targetUser); });
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

    if (usersToExclude.length > 0) {
      query._id = {
          $nin: usersToExclude.filter(id => mongoose.Types.ObjectId.isValid(id)),
          $ne: currentUser._id
      };
    }

    console.log(`[DISCOVER PROFILES] User ID: ${currentUser._id}`);
    console.log(`[DISCOVER PROFILES] User Preferences: Age ${currentUser.preferences?.ageRange?.min}-${currentUser.preferences?.ageRange?.max}, Dist: ${currentUser.preferences?.distance}km`);
    console.log(`[DISCOVER PROFILES] User InterestedIn: ${currentUser.interestedIn?.join(', ')}`);
    console.log(`[DISCOVER PROFILES] Query to MongoDB: ${JSON.stringify(query, null, 2)}`);
    console.log(`[DISCOVER PROFILES] Users to Exclude (${usersToExclude.length}): ${usersToExclude.map(id => id.toString()).join(', ')}`);

    const potentialMatches = await User.find(query)
      .select('_id name dateOfBirth gender photos bio location interests occupation education')
      .limit(5); // Corrected to 5 as per user's primary requirement
    
    console.log(`[DISCOVER PROFILES] Found ${potentialMatches.length} potential matches from DB (query was limited to 5).`);

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
    return res.json({ success: true, profiles: formattedUsers });
  } catch (error: unknown) {
    console.error('Discover profiles error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: 'Server error', error: errorMessage });
  }
});

// Test route (optional, can be removed for production)
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Profiles test route is working!' });
});

export default router;
