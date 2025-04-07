const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  photos: [{
    url: {
      type: String,
      required: true
    },
    isMain: {
      type: Boolean,
      default: false
    }
  }],
  bio: {
    type: String,
    maxlength: 500
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    city: String,
    country: String
  },
  interests: [{
    type: String
  }],
  occupation: String,
  education: String,
  height: Number,
  preferences: {
    ageRange: {
      min: {
        type: Number,
        default: 18
      },
      max: {
        type: Number,
        default: 100
      }
    },
    distance: {
      type: Number,
      default: 50 // km
    }
  },
  // Track profiles that liked this profile
  likedBy: [{
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile'
    },
    likedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastActive: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create geospatial index for location-based queries
ProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Profile', ProfileSchema);
