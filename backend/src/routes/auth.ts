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

// @route   POST /api/auth/register
// @desc    Register a new user
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
      subscriptionTier: defaultPlan.planId, // Assign default plan ID
      dailyLikeQuota: defaultPlan.dailyLikeQuota, // Assign quota from default plan
      remainingLikes: defaultPlan.dailyLikeQuota, // Assign remaining likes from default plan
      // likesResetTime will be set by its default in the User model
    });

    if (user) {
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          gender: user.gender,
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

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    // Check user and password
    if (user && (await user.matchPassword(password))) {
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
