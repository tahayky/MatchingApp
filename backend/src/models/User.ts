import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Define types
export type Gender = 'male' | 'female' | 'other';

// Define interfaces
export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  interestedIn: Gender[];
  isProfileComplete: boolean;
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
    required: true,
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

// Define the this-context for pre hooks with proper typing
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to check password
UserSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Create and export the User model
const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;
