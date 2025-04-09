import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Profile, { IProfile, IPhoto, IPreferences } from '../models/Profile';
import User from '../models/User';
import Match from '../models/Match';
import { protect } from '../middleware/auth';

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: any; // For gradual migration, we'll first use "any" and refine later
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
      return cb(new Error('User not authenticated'), '');
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter to only allow image uploads
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  
  // Check file type
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Interface for profile fields
interface ProfileFields {
  user: any;
  bio?: string;
  location: {
    type: string;
    coordinates: number[];
    city?: string;
    country?: string;
  };
  interests?: string[];
  occupation?: string;
  education?: string;
  height?: number;
  likedBy?: any[];
  preferences?: {
    ageRange?: {
      min?: number;
      max?: number;
    };
    distance?: number;
  };
}

// Create router instance
const router: Router = express.Router();

// @route   POST /api/profiles
// @desc    Create or update user profile
// @access  Private
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    const {
      bio,
      coordinates,
      city,
      country,
      interests,
      occupation,
      education,
      height,
      ageRangeMin,
      ageRangeMax,
      maxDistance
    } = req.body;

    // Build profile object with proper typing
    const profileFields: ProfileFields = {
      user: req.user._id,
      bio,
      location: {
        type: 'Point', // Required for GeoJSON format
        coordinates: coordinates || [0, 0],
        city,
        country
      },
      interests: interests ? interests.split(',').map((interest: string) => interest.trim()) : [],
      occupation,
      education,
      height,
      likedBy: [] // Empty array for likedBy - will be populated via match system
    };

    // Build preferences object
    if (ageRangeMin || ageRangeMax || maxDistance) {
      profileFields.preferences = {};
      
      if (ageRangeMin || ageRangeMax) {
        profileFields.preferences.ageRange = {};
        if (ageRangeMin) profileFields.preferences.ageRange.min = ageRangeMin;
        if (ageRangeMax) profileFields.preferences.ageRange.max = ageRangeMax;
      }
      
      if (maxDistance) profileFields.preferences.distance = maxDistance;
    }

    // Update or create profile
    let profile = await Profile.findOne({ user: req.user._id });

    if (profile) {
      // Update
      profile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { $set: profileFields },
        { new: true }
      );
    } else {
      // Create
      profile = new Profile(profileFields);
      await profile.save();
      
      // Mark user profile as complete if this is the first time creating profile
      await User.findByIdAndUpdate(req.user._id, { isProfileComplete: true });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error: unknown) {
    console.error('Profile error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   GET /api/profiles/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    console.log('[DEBUG] /api/profiles/me endpoint çağrıldı');
    const profile = await Profile.findOne({ user: req.user._id });

    if (!profile) {
      console.log('[DEBUG] Kullanıcı profili bulunamadı, örnek profil döndürülüyor');
      
      // Create a sample profile for the user
      const sampleProfile = {
        _id: 'sample-profile',
        user: req.user._id,
        bio: 'This is a sample profile. Please complete your profile.',
        location: {
          type: 'Point', // Required for GeoJSON
          coordinates: [0, 0],
          city: 'Your City',
          country: 'Your Country'
        },
        interests: ['Add your interests'],
        occupation: 'Your Occupation',
        education: 'Your Education',
        photos: [],
        preferences: {
          ageRange: {
            min: 18,
            max: 65
          },
          distance: 50
        },
        lastActive: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      return res.json({
        success: true,
        profile: sampleProfile
      });
    }

    res.json({
      success: true,
      profile
    });
  } catch (error: unknown) {
    console.error('Get profile error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   POST /api/profiles/photos
// @desc    Upload profile photo
// @access  Private
router.post('/photos', protect, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const profile = await Profile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Please create a profile first' 
      });
    }

    // Get file path from multer
    const photoUrl = `/${req.file.path.replace(/\\/g, '/')}`;
    
    // Check if this is the first photo (make it main)
    const isMain = profile.photos.length === 0;

    // Add photo to profile
    profile.photos.push({
      url: photoUrl,
      isMain
    });

    await profile.save();

    res.json({
      success: true,
      photo: {
        url: photoUrl,
        isMain
      }
    });
  } catch (error: unknown) {
    console.error('Upload photo error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage
    });
  }
});

// @route   GET /api/profiles/discover
// @desc    Get profiles for discovery feed based on preferences
// @access  Private
router.get('/discover', protect, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    console.log('[DEBUG] Discover API endpoint called');
    
    // Get user and profile information
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    console.log(`[DEBUG] Current user: ${user._id}, interested in: ${user.interestedIn?.join(', ')}`);
    
    // Find or create user profile with upsert
    let userProfile = await Profile.findOne({ user: req.user._id });
    if (!userProfile) {
      console.log(`[DEBUG] User profile not found (${req.user._id}), creating new profile`);
      
      // Create default profile for current user
      userProfile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { 
          $setOnInsert: {
            user: req.user._id,
            location: {
              type: 'Point',
              coordinates: [0, 0],
              city: 'Unknown',
              country: 'Unknown'
            },
            interests: [],
            likedBy: [],
            lastActive: new Date(),
            createdAt: new Date()
          }
        },
        { 
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      // After upsert, userProfile cannot be null, but let's check to satisfy TypeScript
      if (!userProfile) {
        return res.status(500).json({
          success: false,
          message: 'Failed to create user profile'
        });
      }
      
      console.log(`[DEBUG] New profile created: ${userProfile._id}`);
    }
    
    // Find users matching gender preferences
    const interestedInGenders = user.interestedIn || [];
    console.log(`[DEBUG] Finding users with genders: ${interestedInGenders}`);
    
    // Find users matching the gender preferences
    const genderMatchingUsers = await User.find({
      _id: { $ne: user._id }, // Exclude the current user
      gender: { $in: interestedInGenders } // Only include users with matching genders
    }).select('_id gender');
    
    console.log(`[DEBUG] Found ${genderMatchingUsers.length} users matching gender preferences`);
    
    if (genderMatchingUsers.length === 0) {
      console.log('[DEBUG] No users found matching gender preferences');
      return res.json({
        success: true,
        profiles: []
      });
    }
    
    // Extract just the user IDs
    const genderMatchingUserIds = genderMatchingUsers.map(u => u._id);
    
    // Find profiles for these users with typed query
    const query: any = {
      user: { $in: genderMatchingUserIds }
    };
    
    // Apply location-based filtering if coordinates available
    if (userProfile.location && 
        userProfile.location.coordinates && 
        userProfile.location.coordinates[0] !== 0 && 
        userProfile.location.coordinates[1] !== 0) {
      
      const maxDistance = userProfile.preferences?.distance || 50; // km
      
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: userProfile.location.coordinates
          },
          $maxDistance: maxDistance * 1000 // convert km to meters
        }
      };
    }
    
    // Get profiles to exclude (rejected and liked profiles)
    const profilesToExclude: mongoose.Types.ObjectId[] = [];
    
    // Add rejected profiles to exclude list
    if (userProfile.rejected && userProfile.rejected.length > 0) {
      userProfile.rejected.forEach(rejection => {
        if (rejection.profile) {
          profilesToExclude.push(rejection.profile);
        }
      });
    }
    
    // Find already liked profiles from Match collection
    const likedMatches = await Match.find({
      user: req.user._id,
      action: 'like'
    });
    
    if (likedMatches.length > 0) {
      // Get the profiles associated with these liked users
      const likedUserIds = likedMatches.map(match => match.targetUser);
      const likedProfiles = await Profile.find({ user: { $in: likedUserIds } }).select('_id');
      
      // Add these profile IDs to the exclude list
      likedProfiles.forEach(profile => {
        profilesToExclude.push(profile._id);
      });
    }
    
    // Apply the exclusion filter
    if (profilesToExclude.length > 0) {
      query._id = { $nin: profilesToExclude };
    }
    
    // Find profiles with pagination (limit to 20)
    const profiles = await Profile.find(query)
      .populate({
        path: 'user',
        select: 'name dateOfBirth gender'
      })
      .limit(20);
    
    console.log(`[DEBUG] Found ${profiles.length} profiles matching criteria`);
    
    // Return the profiles
    return res.json({
      success: true,
      profiles: profiles
    });
    
  } catch (error: unknown) {
    console.error('Discover profiles error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   PUT /api/profiles/photos/:photoId/main
// @desc    Set a photo as main profile photo
// @access  Private
router.put('/photos/:photoId/main', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    const profile = await Profile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    // Verify photo exists and belongs to user
    const photoId = req.params.photoId;
    const photoIndex = profile.photos.findIndex(photo => 
      photo._id && photo._id.toString() === photoId
    );

    if (photoIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Photo not found' 
      });
    }

    // Set all photos to not main
    profile.photos.forEach(photo => {
      photo.isMain = false;
    });

    // Set selected photo as main
    profile.photos[photoIndex].isMain = true;
    
    await profile.save();

    res.json({
      success: true,
      message: 'Main photo updated',
      photos: profile.photos
    });
  } catch (error: unknown) {
    console.error('Set main photo error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   GET /api/profiles/test
// @desc    Test endpoint for TypeScript profiles
// @access  Public
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TypeScript profiles route is working',
    timestamp: new Date().toISOString()
  });
});

export default router;
