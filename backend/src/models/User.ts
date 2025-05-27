import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Define types
export type Gender = 'male' | 'female' | 'other';

// Define interfaces for Profile-related data structures
export interface IPhoto {
  url: string;
  isMain: boolean;
  _id?: mongoose.Types.ObjectId;
}

export interface ILocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  city?: string;
  country?: string;
}

export interface IAgeRange {
  min: number;
  max: number;
}

export interface IPreferences {
  ageRange?: IAgeRange;
  distance?: number; // in km
}

export interface ILikeData {
  user: mongoose.Types.ObjectId; // Changed from profile to user
  likedAt: Date;
  _id?: mongoose.Types.ObjectId;
}

export interface IRejectData {
  user: mongoose.Types.ObjectId; // Changed from profile to user
  rejectedAt: Date;
  _id?: mongoose.Types.ObjectId;
}


// Define interfaces
export interface IUser extends Document {
  email: string;
  password?: string; // Password is now optional
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  interestedIn: Gender[];
  isProfileComplete: boolean;

  // Profile fields
  photos: IPhoto[];
  bio?: string;
  location: ILocation;
  interests: string[];
  occupation?: string;
  education?: string;
  height?: number; // in cm
  preferences?: IPreferences;
  likedBy: ILikeData[]; // Users who liked this user
  rejected: IRejectData[]; // Users this user has rejected/passed
  viewedProfiles: mongoose.Types.ObjectId[]; // Users this user has seen
  lastActive: Date;

  // Subscription and quota fields
  subscriptionTier: string;
  subscriptionExpiresAt?: Date;
  dailyLikeQuota: number;
  remainingLikes: number;
  likesResetTime: Date;
  // Admin and role management
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

// Create the schema
const UserSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: false, // Password is now optional
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  interestedIn: {
    type: [String],
    enum: ['male', 'female', 'other'],
    required: true
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },

  // Profile fields
  photos: [{
    url: { type: String, required: true },
    isMain: { type: Boolean, default: false }
  }],
  bio: { type: String, maxlength: 500 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
    city: String,
    country: String
  },
  interests: [{ type: String }],
  occupation: String,
  education: String,
  height: Number, // in cm
  preferences: {
    ageRange: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 100 }
    },
    distance: { type: Number, default: 50 } // km
  },
  likedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Changed from Profile to User
    likedAt: { type: Date, default: Date.now }
  }],
  rejected: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Changed from Profile to User
    rejectedAt: { type: Date, default: Date.now }
  }],
  viewedProfiles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastActive: { type: Date, default: Date.now },

  // Subscription and quota fields
  subscriptionTier: {
    type: String,
    default: 'FREE' // Default to free tier
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null // Only set for paid subscriptions
  },
  dailyLikeQuota: {
    type: Number,
    default: 5 // Default number of likes per day (FREE tier) - Updated to match subscriptionTiers.ts
  },
  remainingLikes: {
    type: Number,
    default: 5 // Start with full quota - Updated to match quota
  },
  likesResetTime: {
    type: Date,
    default: () => {
      const now = new Date();
      // Set reset time to midnight tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow;
    }
  },
  // Admin role
  isAdmin: {
    type: Boolean,
    default: false // Users are not admins by default
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create geospatial index for location-based queries
UserSchema.index({ location: '2dsphere' });

// Define the this-context for pre hooks with proper typing
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to check password (only if password exists)
UserSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Create and export the User model
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;
