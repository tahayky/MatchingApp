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
    const userProfile = await Profile.findOne({ user: req.user._id });
    const user = await User.findById(req.user._id);
    
    // Kullanıcı veya profil bulunamazsa
    if (!userProfile || !user) {
      console.log('[DEBUG] Kullanıcı profili bulunamadı');
      
      // Örnek profiller oluştur - frontend'e bazı veriler vermek için
      const sampleProfiles = [];
      
      // Sistemdeki 5 rastgele kullanıcıyı bul
      const sampleUsers = await User.find({ _id: { $ne: req.user._id } }).limit(5);
      
      // Her kullanıcı için örnek profil oluştur
      for (const sampleUser of sampleUsers) {
        // Kullanıcı profilini bul
        const profile = await Profile.findOne({ user: sampleUser._id });
        
        // Profil varsa ekle
        if (profile) {
          sampleProfiles.push({
            _id: profile._id,
            user: {
              _id: sampleUser._id,
              name: sampleUser.name,
              dateOfBirth: sampleUser.dateOfBirth,
              gender: sampleUser.gender
            },
            photos: profile.photos || [],
            bio: profile.bio || 'No bio available',
            location: profile.location || { city: 'Unknown', country: 'Unknown' },
            interests: profile.interests || [],
            occupation: profile.occupation || 'Not specified',
            education: profile.education || 'Not specified'
          });
        }
      }
      
      // Eğer hiç profil bulunamazsa, örnek profil oluştur
      if (sampleProfiles.length === 0) {
        console.log('[DEBUG] Örnek profiller oluşturuluyor');
        
        // Garanti çalışacak örnek profiller oluştur
        for (let i = 1; i <= 5; i++) {
          sampleProfiles.push({
            _id: `sample-${i}`, // ID formatı önemli
            user: {
              _id: `user-${i}`,
              name: `Sample User ${i}`,
              dateOfBirth: new Date(1990, 0, 1).toISOString(),
              gender: i % 2 === 0 ? 'male' : 'female'
            },
            photos: [{ // Her zaman en az bir fotoğraf ekleyelim
              _id: `photo-sample-${i}`,
              url: 'https://i.pravatar.cc/300', // Rastgele avatar resmi
              isMain: true
            }],
            bio: `This is a sample profile ${i}. Swiping right on this profile will simulate a match!`,
            location: { city: 'İstanbul', country: 'Türkiye' },
            interests: ['dating', 'matching', 'profiles'],
            occupation: 'Sample Job',
            education: 'Sample University'
          });
        }
      }
      
      return res.json({
        success: true,
        profiles: sampleProfiles
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
      
    console.log(`[DEBUG] Bulunan profil sayısı: ${profiles.length}`);
    
    // Check if we need to include demo profiles
    if (profiles.length === 0) {
      console.log('[DEBUG] Gerçek profil bulunamadı, demo profiller ekleniyor');
      
      // Generate demo profiles
      const demoProfiles = [];
      for (let i = 1; i <= 3; i++) {
        demoProfiles.push({
          _id: `sample-${i}`,
          user: {
            _id: `user-${i}`,
            name: `Demo User ${i}`,
            dateOfBirth: new Date(1990, 0, 1).toISOString(),
            gender: i % 2 === 0 ? 'male' : 'female'
          },
          photos: [{ 
            _id: `photo-sample-${i}`,
            url: `https://i.pravatar.cc/300?img=${i+20}`,
            isMain: true
          }],
          bio: `Demo profile for testing (#${i}).`,
          location: { city: 'Demo City', country: 'Demo Country' },
          interests: ['demo', 'testing'],
          occupation: 'Demo Job',
          education: 'Demo University'
        });
      }
      
      // Log and respond
      console.log(`[DEBUG] ${demoProfiles.length} demo profil ekleniyor`);
      res.json({
        success: true,
        profiles: demoProfiles
      });
    } else {
      // Return real profiles
      console.log('[DEBUG] Gerçek profiller döndürülüyor');
      res.json({
        success: true,
        profiles
      });
    }
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
