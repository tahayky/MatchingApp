import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User, { IUser, IPhoto, IPreferences, IRejectData, ILikeData } from '../models/User'; // Updated import
import Match from '../models/Match';
import { protect } from '../middleware/auth';

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser; // User IUser for better type safety
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

    const userToUpdate = await User.findById(req.user._id);

    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user fields directly
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
    
    // Ensure default arrays if they don't exist
    userToUpdate.photos = userToUpdate.photos || [];
    userToUpdate.likedBy = userToUpdate.likedBy || [];
    userToUpdate.rejected = userToUpdate.rejected || [];
    userToUpdate.lastActive = new Date();
    userToUpdate.isProfileComplete = true; // Mark profile as complete upon update/creation

    await userToUpdate.save();

    res.json({
      success: true,
      user: userToUpdate // Return the updated user object
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

    const userProfile = await User.findById(req.user._id).select('-password'); // Exclude password

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found. Please complete your profile.'
      });
    }

    res.json({
      success: true,
      user: userProfile
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

    const user = await User.findById(req.user._id);

    if (!user) {
      // If file was uploaded but user doesn't exist (should not happen with 'protect'), remove the uploaded file
      if (req.file && req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting orphaned file:", err);
        });
      }
      return res.status(404).json({
        success: false,
        message: 'User not found. Please complete your profile first.'
      });
    }

    const photoUrl = `/${req.file.path.replace(/\\/g, '/')}`;
    // Ensure photos array exists
    if (!user.photos) {
        user.photos = [];
    }
    const isMain = user.photos.length === 0;

    user.photos.push({
      url: photoUrl,
      isMain
    } as IPhoto);

    await user.save();

    res.json({
      success: true,
      photo: {
        url: photoUrl,
        isMain
      },
      photos: user.photos // Send back all photos
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
        message: 'Current user not found'
      });
    }
    // Ensure profile fields are initialized if not present
    currentUser.location = currentUser.location || { type: 'Point', coordinates: [0,0], city: 'Unknown', country: 'Unknown' };
    currentUser.preferences = currentUser.preferences || { ageRange: {min: 18, max: 100}, distance: 50};
    currentUser.rejected = currentUser.rejected || [];
    currentUser.likedBy = currentUser.likedBy || [];


    const interestedInGenders = currentUser.interestedIn || [];

    const query: mongoose.FilterQuery<IUser> = {
      _id: { $ne: currentUser._id }, // Exclude current user
      gender: { $in: interestedInGenders },
      isProfileComplete: true // Only show users with completed profiles
    };
    
    // Location-based filtering
    if (currentUser.location &&
        currentUser.location.coordinates &&
        (currentUser.location.coordinates[0] !== 0 || currentUser.location.coordinates[1] !== 0)) {
      const maxDistance = currentUser.preferences?.distance || 50;
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: currentUser.location.coordinates
          },
          $maxDistance: maxDistance * 1000 // Convert km to meters
        }
      };
    }

    // Age-based filtering (approximate, as we store dateOfBirth)
    if (currentUser.preferences?.ageRange) {
        const minAge = currentUser.preferences.ageRange.min;
        const maxAge = currentUser.preferences.ageRange.max;
        const today = new Date();
        const minBirthDate = new Date(today.getFullYear() - maxAge -1, today.getMonth(), today.getDate());
        const maxBirthDate = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
        query.dateOfBirth = { $gte: minBirthDate, $lte: maxBirthDate };
    }


    const usersToExclude: mongoose.Types.ObjectId[] = [];

    // Add users already rejected by the current user
    if (currentUser.rejected && currentUser.rejected.length > 0) {
      currentUser.rejected.forEach((rejection: IRejectData) => {
        if (rejection.user) { // user field in IRejectData
          usersToExclude.push(rejection.user);
        }
      });
    }

    // Add users already liked by the current user (from Match collection)
    const likedMatches = await Match.find({
      user: currentUser._id,
      action: 'like'
    }).select('targetUser');

    if (likedMatches.length > 0) {
      likedMatches.forEach(match => {
        usersToExclude.push(match.targetUser);
      });
    }
    
    // Add users who have liked the current user (from Match collection where isMatch is true)
    // This prevents showing users you've already matched with.
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
          $ne: currentUser._id // Ensure current user is still excluded
      };
    }


    const potentialMatches = await User.find(query)
      .select('_id name dateOfBirth gender photos bio location interests occupation education') // Select necessary fields
      .limit(20);

    // Format users before sending
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
        _id: u._id,
        name: u.name,
        gender: u.gender,
        age: age,
        photos: u.photos,
        bio: u.bio,
        location: u.location ? { city: u.location.city, country: u.location.country } : undefined,
        interests: u.interests,
        occupation: u.occupation,
        education: u.education,
      };
    });

    return res.json({
      success: true,
      profiles: formattedUsers // Keep 'profiles' key for client compatibility for now
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

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.photos) {
        user.photos = []; // Ensure photos array exists
    }

    let photoFound = false;
    user.photos.forEach((photo: IPhoto) => {
      // Mongoose subdocument _id might not be a string, ensure comparison is correct
      if (photo._id && photo._id.toString() === photoId) {
        photo.isMain = true;
        photoFound = true;
      } else {
        photo.isMain = false;
      }
    });

    if (!photoFound) {
      return res.status(404).json({ success: false, message: 'Photo not found in user profile' });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Main photo updated successfully',
      photos: user.photos // Send back updated photos array
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
