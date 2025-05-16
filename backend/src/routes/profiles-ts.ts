import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Profile, { IProfile, IPhoto, IPreferences, IProfileReject, IProfileLike } from '../models/Profile';
import User, { IUser } from '../models/User'; // Import IUser
import Match from '../models/Match';
import { protect } from '../middleware/auth';

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser; // Use IUser for better type safety
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
    cb(null, `${req.user._id.toString()}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter to only allow image uploads
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png, webp) are allowed') as any); // Cast error for cb
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Interface for profile fields when creating/updating
interface ProfileInputFields {
  user: mongoose.Types.ObjectId;
  bio?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
    city?: string;
    country?: string;
  };
  interests?: string[];
  occupation?: string;
  education?: string;
  height?: number;
  likedBy?: IProfileLike[]; // Use IProfileLike from model
  rejected?: IProfileReject[]; // Use IProfileReject from model
  preferences?: IPreferences; // Use IPreferences from model
  lastActive?: Date;
}


// Create router instance
const router: Router = express.Router();

// @route   POST /api/profiles
// @desc    Create or update user profile
// @access  Private
router.post('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    const {
      bio,
      coordinates, // Expecting [longitude, latitude]
      city,
      country,
      interests, // Expecting comma-separated string or array
      occupation,
      education,
      height,
      ageRangeMin,
      ageRangeMax,
      maxDistance
    } = req.body;

    const profileFields: Partial<ProfileInputFields> = { // Use Partial as not all fields are required for update
      user: req.user._id,
    };

    if (bio !== undefined) profileFields.bio = bio;
    profileFields.location = {
        type: 'Point',
        coordinates: coordinates || [0,0] as [number, number], // Default if not provided
        city: city,
        country: country
    };
    if (interests !== undefined) {
        profileFields.interests = Array.isArray(interests) ? interests : (interests as string).split(',').map((interest: string) => interest.trim());
    }
    if (occupation !== undefined) profileFields.occupation = occupation;
    if (education !== undefined) profileFields.education = education;
    if (height !== undefined) profileFields.height = height;
    
    profileFields.preferences = {
        ageRange: {
            min: ageRangeMin !== undefined ? parseInt(ageRangeMin, 10) : 18,
            max: ageRangeMax !== undefined ? parseInt(ageRangeMax, 10) : 100
        },
        distance: maxDistance !== undefined ? parseInt(maxDistance, 10) : 50
    };


    let profile = await Profile.findOne({ user: req.user._id });

    if (profile) {
      profile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { $set: profileFields },
        { new: true, runValidators: true } // Added runValidators
      );
    } else {
      // For creation, ensure all required fields for ProfileInputFields are present or have defaults
      const createFields: ProfileInputFields = {
        user: req.user._id,
        location: profileFields.location || { type: 'Point', coordinates: [0,0], city: 'Unknown', country: 'Unknown'},
        likedBy: [],
        rejected: [],
        lastActive: new Date(),
        ...profileFields // Spread other optional fields
      };
      profile = new Profile(createFields);
      await profile.save();
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
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    const profile = await Profile.findOne({ user: req.user._id });

    if (!profile) {
      // If no profile, return a clear message, not a sample one.
      // The client can decide how to handle a non-existent profile (e.g., prompt for creation).
      return res.status(404).json({
        success: false,
        message: 'Profile not found for this user. Please create one.'
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
      // If file was uploaded but profile doesn't exist, remove the uploaded file to prevent orphans
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting orphaned file:", err);
        });
      }
      return res.status(404).json({ 
        success: false, 
        message: 'Please create a profile first' 
      });
    }

    const photoUrl = `/${req.file.path.replace(/\\/g, '/')}`;
    const isMain = profile.photos.length === 0;

    profile.photos.push({
      url: photoUrl,
      isMain
    } as IPhoto); // Cast to IPhoto

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
    // If there was an error during DB save but file was uploaded, try to delete it.
    if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting file after DB error:", err);
        });
    }
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
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, user not found' 
      });
    }
    
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    let userProfile = await Profile.findOne({ user: req.user._id });
    if (!userProfile) {
      // Create a default profile if one doesn't exist
      userProfile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { 
          $setOnInsert: {
            user: req.user._id,
            location: { type: 'Point', coordinates: [0,0] as [number,number], city: 'Unknown', country: 'Unknown' },
            interests: [],
            likedBy: [],
            rejected: [],
            lastActive: new Date(),
            createdAt: new Date(),
            preferences: { ageRange: {min: 18, max: 100}, distance: 50} // Default preferences
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      if (!userProfile) {
        return res.status(500).json({ success: false, message: 'Failed to create user profile' });
      }
    }
    
    const interestedInGenders = currentUser.interestedIn || [];
    
    const genderMatchingUsers = await User.find({
      _id: { $ne: currentUser._id }, 
      gender: { $in: interestedInGenders } 
    }).select('_id'); // Only need IDs for the next query
    
    if (genderMatchingUsers.length === 0) {
      return res.json({ success: true, profiles: [] });
    }
    
    const genderMatchingUserIds = genderMatchingUsers.map(u => u._id);
    
    const query: mongoose.FilterQuery<IProfile> = { // Use mongoose.FilterQuery
      user: { $in: genderMatchingUserIds }
    };
    
    if (userProfile.location && 
        userProfile.location.coordinates && 
        (userProfile.location.coordinates[0] !== 0 || userProfile.location.coordinates[1] !== 0)) { // Check both coords
      
      const maxDistance = userProfile.preferences?.distance || 50; 
      
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: userProfile.location.coordinates
          },
          $maxDistance: maxDistance * 1000 
        }
      };
    }
    
    const profilesToExclude: mongoose.Types.ObjectId[] = [];
    
    if (userProfile.rejected && userProfile.rejected.length > 0) {
      userProfile.rejected.forEach((rejection: IProfileReject) => { // Type rejection
        if (rejection.profile) {
          profilesToExclude.push(rejection.profile);
        }
      });
    }
    
    const likedMatches = await Match.find({
      user: req.user._id,
      action: 'like' // No need to check isMatch here, just liked actions
    }).select('targetUser'); // Only select targetUser
    
    if (likedMatches.length > 0) {
      const likedUserIds = likedMatches.map(match => match.targetUser);
      // Find profiles of users already liked by current user
      const likedTargetProfiles = await Profile.find({ user: { $in: likedUserIds } }).select('_id');
      likedTargetProfiles.forEach(profile => {
        profilesToExclude.push(profile._id);
      });
    }
    
    if (profilesToExclude.length > 0) {
      query._id = { $nin: profilesToExclude.filter(id => mongoose.Types.ObjectId.isValid(id)) }; // Ensure valid ObjectIds
    }
    
    const profiles = await Profile.find(query)
      .populate<{ user: Pick<IUser, '_id' | 'name' | 'dateOfBirth' | 'gender'> }>({ // Type populated user
        path: 'user',
        select: '_id name dateOfBirth gender' // Added _id to select
      })
      .limit(20); // Discovery limit
    
    // Format profiles before sending
    const formattedProfiles = profiles.map(p => {
        const user = p.user as Pick<IUser, '_id' | 'name' | 'dateOfBirth' | 'gender'>; // Type assertion, now includes _id
        // Calculate age (ensure dateOfBirth is a Date object or valid date string)
        let age;
        if (user && user.dateOfBirth) {
            const birthDate = new Date(user.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        return {
            _id: p._id,
            user: { // user object now correctly includes _id due to updated populate
                _id: user?._id,
                name: user?.name,
                gender: user?.gender,
                age: age // Include calculated age
            },
            photos: p.photos,
            bio: p.bio,
            location: p.location ? { city: p.location.city, country: p.location.country } : undefined,
            interests: p.interests,
            occupation: p.occupation,
            education: p.education,
        };
    });


    return res.json({
      success: true,
      profiles: formattedProfiles
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
    
    const { photoId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(photoId)) {
        return res.status(400).json({ success: false, message: 'Invalid photo ID' });
    }

    const profile = await Profile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    let photoFound = false;
    profile.photos.forEach((photo: IPhoto) => { // Type photo
      if (photo._id && photo._id.toString() === photoId) {
        photo.isMain = true;
        photoFound = true;
      } else {
        photo.isMain = false;
      }
    });

    if (!photoFound) {
      return res.status(404).json({ success: false, message: 'Photo not found in profile' });
    }

    await profile.save();

    res.json({
      success: true,
      message: 'Main photo updated successfully',
      photos: profile.photos // Send back updated photos array
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


// Test route (optional, can be removed for production)
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Profiles test route is working!' });
});

export default router;
