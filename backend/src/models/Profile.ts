import mongoose, { Schema, Document, Model } from 'mongoose';

// Define interfaces for Profile document
export interface IPhoto {
  url: string;
  isMain: boolean;
  _id?: mongoose.Types.ObjectId;
}

export interface ILocation {
  type: 'Point';
  coordinates: [number, number];
  city?: string;
  country?: string;
}

export interface IAgeRange {
  min: number;
  max: number;
}

export interface IPreferences {
  ageRange?: IAgeRange;
  distance?: number;
}

export interface IProfileLike {
  profile: mongoose.Types.ObjectId;
  likedAt: Date;
  _id?: mongoose.Types.ObjectId;
}

export interface IProfileReject {
  profile: mongoose.Types.ObjectId;
  rejectedAt: Date;
  _id?: mongoose.Types.ObjectId;
}

export interface IProfile extends Document {
  user: mongoose.Types.ObjectId;
  photos: IPhoto[];
  bio?: string;
  location: ILocation;
  interests: string[];
  occupation?: string;
  education?: string;
  height?: number;
  preferences?: IPreferences;
  likedBy: IProfileLike[];
  rejected: IProfileReject[];
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProfileSchema: Schema = new Schema({
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
  // Track profiles that this user has rejected/passed
  rejected: [{
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile'
    },
    rejectedAt: {
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

// Create and export the Profile model
const Profile: Model<IProfile> = mongoose.model<IProfile>('Profile', ProfileSchema);
export default Profile;
