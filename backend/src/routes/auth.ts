import express, { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan'; // Import SubscriptionPlan
import { protect } from '../middleware/auth';

const router: Router = express.Router();

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser;
}

// Generate JWT token
const generateToken = (id: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign({ id }, jwtSecret, {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/check-email
// @desc    Check if email already exists
// @access  Public
router.post('/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const userExists = await User.findOne({ email });
    
    res.json({
      success: true,
      exists: !!userExists
    });
  } catch (error: unknown) {
    console.error('Check email error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage
    });
  }
});

// @route   POST /api/auth/register-without-password
// @desc    Register a new user without password
// @access  Public
router.post('/register-without-password', async (req: Request, res: Response) => {
  try {
    const { email, name, dateOfBirth, gender, interestedIn } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Find the default subscription plan
    const defaultPlan = await SubscriptionPlan.findOne({ isDefault: true, isActive: true });

    if (!defaultPlan) {
      console.error('CRITICAL: No default subscription plan found or active.');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please contact support.'
      });
    }

    // Create user without password
    const user = await User.create({
      email,
      name,
      dateOfBirth,
      gender,
      interestedIn,
      subscriptionTier: defaultPlan.planId, // Use planId instead of tier
      dailyLikeQuota: defaultPlan.dailyLikeQuota, // Use dailyLikeQuota from plan
      remainingLikes: defaultPlan.dailyLikeQuota, // Use dailyLikeQuota from plan
      lastLikeReset: new Date()
    });

    if (user) {
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          gender: user.gender,
          isProfileComplete: user.isProfileComplete,
          token: generateToken(user._id)
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid user data'
      });
    }
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user (with password - legacy)
// @access  Public
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, dateOfBirth, gender, interestedIn } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Find the default subscription plan
    const defaultPlan = await SubscriptionPlan.findOne({ isDefault: true, isActive: true });

    if (!defaultPlan) {
      // This case should ideally be handled by ensuring a default plan always exists.
      // For now, log an error and prevent registration or fall back to a hardcoded basic plan.
      console.error('CRITICAL: No default subscription plan found or active. User registration cannot proceed with dynamic default tier.');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: No default subscription plan set.'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      name,
      dateOfBirth,
      gender,
      interestedIn,
      // Subscription fields
      subscriptionTier: defaultPlan.planId,
      dailyLikeQuota: defaultPlan.dailyLikeQuota,
      remainingLikes: defaultPlan.dailyLikeQuota,
      // likesResetTime will be set by its default in the User model

      // Initialize merged profile fields
      photos: [], // Default to empty array
      bio: '',    // Default to empty string
      location: { // Default location (e.g., [0,0] or prompt user to set later)
        type: 'Point',
        coordinates: [0, 0],
        city: '',
        country: '',
      },
      interests: [], // Default to empty array
      occupation: '',
      education: '',
      height: undefined, // Or a default like 0 if preferred
      preferences: { // Default preferences
        ageRange: { min: 18, max: 99 },
        distance: 50, // Default distance in km
      },
      likedBy: [],
      rejected: [],
      lastActive: new Date(),
      isProfileComplete: false, // Explicitly set to false, user needs to complete it
    });

    if (user) {
      // Return a more complete user object, but still exclude sensitive data like full profile details initially
      // The client can fetch full profile details via /api/users/profile/me if needed
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          gender: user.gender,
          isProfileComplete: user.isProfileComplete, // Include this status
          token: generateToken(user._id)
        }
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid user data' 
      });
    }
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   POST /api/auth/login-without-password
// @desc    Login user without password (email only)
// @access  Public
router.post('/login-without-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (user) {
      res.json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          gender: user.gender,
          isProfileComplete: user.isProfileComplete,
          token: generateToken(user._id)
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
  } catch (error: unknown) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token (with password - legacy)
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    // Check user and password
    if (user && password && (await user.matchPassword(password))) {
      res.json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          gender: user.gender,
          isProfileComplete: user.isProfileComplete,
          token: generateToken(user._id)
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
  } catch (error: unknown) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }
    
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      user
    });
  } catch (error: unknown) {
    console.error('Get user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

export default router;
