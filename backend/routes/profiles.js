const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = 'uploads/profiles';
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter to only allow image uploads
const fileFilter = (req, file, cb) => {
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

// @route   POST /api/profiles
// @desc    Create or update user profile
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
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

    // Build profile object
    const profileFields = {
      user: req.user._id,
      bio,
      location: {
        type: 'Point', // Required for GeoJSON format
        coordinates: coordinates || [0, 0],
        city,
        country
      },
      interests: interests ? interests.split(',').map(interest => interest.trim()) : [],
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
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   GET /api/profiles/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    console.log('[DEBUG] /api/profiles/me endpoint çağrıldı');
    const profile = await Profile.findOne({ user: req.user._id });

    if (!profile) {
      console.log('[DEBUG] Kullanıcı profili bulunamadı, örnek profil döndürülüyor');
      
      // Kullanıcının kendisi için örnek bir profil döndür
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
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   POST /api/profiles/photos
// @desc    Upload profile photo
// @access  Private
router.post('/photos', protect, upload.single('photo'), async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   PUT /api/profiles/photos/:photoId/main
// @desc    Set a photo as main
// @access  Private
router.put('/photos/:photoId/main', protect, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    // Verify photo exists and belongs to user
    const photoIndex = profile.photos.findIndex(photo => 
      photo._id.toString() === req.params.photoId
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
      message: 'Main photo updated'
    });
  } catch (error) {
    console.error('Set main photo error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   GET /api/profiles/discover
// @desc    Get profiles for discovery feed based on preferences
// @access  Private
router.get('/discover', protect, async (req, res) => {
  try {
    console.log('[DEBUG] Discover API endpoint çağrıldı');
    
    // Kullanıcı ve profil bilgilerini al
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    console.log(`[DEBUG] Current user: ${user._id}, interested in: ${user.interestedIn.join(', ')}`);
    
    // Find or create user profile with upsert
    let userProfile = await Profile.findOne({ user: req.user._id });
    if (!userProfile) {
      console.log(`[DEBUG] Kullanıcı profili bulunamadı (${req.user._id}), yeni profil oluşturuluyor`);
      
      // Create default profile for current user
      userProfile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { 
          $setOnInsert: {
            user: req.user._id,
            location: {
              type: 'Point', // Required for GeoJSON format
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
      
      console.log(`[DEBUG] Yeni profil oluşturuldu: ${userProfile._id}`);
    }
    
    // Step 1: Find all users matching gender preferences
    const interestedInGenders = user.interestedIn;
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
    
    // Step 2: Find profiles for these users
    const query = {
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
    
    console.log(`[DEBUG] Querying profiles with filters: ${JSON.stringify(query)}`);
    
    // Find profiles with pagination (limit to 20)
    const profiles = await Profile.find(query)
      .populate({
        path: 'user',
        select: 'name dateOfBirth gender' // Only include necessary user fields
      })
      .limit(20);
    
    console.log(`[DEBUG] Found ${profiles.length} profiles matching criteria`);
    
    // Verify all returned profiles have users with matching genders
    for (const profile of profiles) {
      if (!profile.user || !profile.user.gender) {
        console.log(`[WARNING] Profile ${profile._id} has no user or gender information`);
        continue;
      }
      
      if (!interestedInGenders.includes(profile.user.gender)) {
        console.log(`[ERROR] Profile ${profile._id} has user with gender ${profile.user.gender} which is not in ${interestedInGenders}`);
      }
    }
    
    // Return the profiles
    return res.json({
      success: true,
      profiles: profiles
    });
    
  } catch (error) {
    console.error('Discover profiles error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;
