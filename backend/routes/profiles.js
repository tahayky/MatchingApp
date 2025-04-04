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
        coordinates: coordinates || [0, 0],
        city,
        country
      },
      interests: interests ? interests.split(',').map(interest => interest.trim()) : [],
      occupation,
      education,
      height
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
    const profile = await Profile.findOne({ user: req.user._id });

    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
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
    // Get user and profile
    const userProfile = await Profile.findOne({ user: req.user._id });
    const user = await User.findById(req.user._id);
    
    if (!userProfile || !user) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    // Set up base filters
    const filters = {
      user: { $ne: req.user._id }, // Not current user
    };

    // Add gender preference filter
    if (user.interestedIn && user.interestedIn.length > 0) {
      // Find users with matching genders to those the current user is interested in
      const interestedUsers = await User.find({ 
        gender: { $in: user.interestedIn } 
      }).select('_id');
      
      filters.user = { 
        $in: interestedUsers.map(u => u._id),
        $ne: req.user._id
      };
    }

    // Get location based distance preference
    const maxDistance = userProfile.preferences?.distance || 50; // km
    
    // Set up geo filter if coordinates are available
    let geoFilter = {};
    if (userProfile.location && userProfile.location.coordinates && 
        userProfile.location.coordinates[0] !== 0 && 
        userProfile.location.coordinates[1] !== 0) {
      geoFilter = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: userProfile.location.coordinates
            },
            $maxDistance: maxDistance * 1000 // convert km to meters
          }
        }
      };
    }

    // Combine all filters
    const combinedFilter = { ...filters, ...geoFilter };

    // Find matching profiles
    const profiles = await Profile.find(combinedFilter)
      .populate('user', 'name dateOfBirth gender')
      .limit(20);

    res.json({
      success: true,
      profiles
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
