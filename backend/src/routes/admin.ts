import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose'; // Import mongoose
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User, { IUser } from '../models/User'; // Import User model and IUser interface
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan'; // Import SubscriptionPlan model
import { isAdminAuthenticated } from '../middleware/adminAuth'; // Import the new middleware

// Load environment variables
dotenv.config();

const router: Router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME_ENV = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_ENV = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1); // Exit if JWT_SECRET is not set, as it's critical for security
}
if (!ADMIN_USERNAME_ENV || !ADMIN_PASSWORD_ENV) {
  console.error('FATAL ERROR: ADMIN_USERNAME or ADMIN_PASSWORD is not defined in environment variables.');
  // Potentially exit or disable admin login if not configured
  // For now, we'll log an error. The login attempt will fail safely.
}

// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (!ADMIN_USERNAME_ENV || !ADMIN_PASSWORD_ENV) {
      // This case should ideally be caught at startup, but as a fallback:
      return res.status(500).json({ success: false, message: 'Admin login is not configured on the server.' });
    }

    if (username === ADMIN_USERNAME_ENV && password === ADMIN_PASSWORD_ENV) {
      // Credentials match. Generate a JWT.
      const payload = {
        user: {
          id: 'admin_user', // Static ID for admin, or could be from a DB if more complex
          role: 'admin',
        },
      };

      jwt.sign(
        payload,
        JWT_SECRET!, // The ! asserts JWT_SECRET is defined due to the check above
        { expiresIn: '7d' }, // Token expires in 7 days
        (err, token) => {
          if (err || !token) { // Added check for !token
            console.error('Error signing JWT or token is undefined:', err);
            return res.status(500).json({ success: false, message: 'Error generating authentication token' });
          }
          
          // Set HttpOnly cookie containing the JWT
          res.cookie('admin_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'lax', // Or 'strict' depending on your needs
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days in milliseconds
            path: '/', // Cookie available for all paths
          });

          // Also return token in response body for client-side convenience if needed,
          // though primary session management should rely on the HttpOnly cookie.
          res.json({
            success: true,
            message: 'Admin login successful',
            token, // Client can use this for immediate state update if desired
          });
        }
      );
    } else {
      // Credentials do not match
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Admin login API error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ success: false, message });
  }
});

// Example protected admin route
// @route   GET /api/admin/stats
// @desc    Get some admin-specific stats (example)
// @access  Private (Admin)
router.get('/stats', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    
    const activeSubscribers = await User.countDocuments({
      subscriptionTier: { $ne: 'FREE' }, // Not on the FREE tier
      $or: [ // And either expiry is not set (if that means active) or is in the future
        { subscriptionExpiresAt: null },
        { subscriptionExpiresAt: { $exists: false } }, // if it might not exist at all
        { subscriptionExpiresAt: { $gt: new Date() } }
      ]
    });

    res.json({
      success: true,
      message: 'Admin stats fetched successfully.',
      data: {
        totalUsers: totalUsers,
        activeSubscriptions: activeSubscribers,
        serverTime: new Date().toISOString(),
        adminInfo: (req as any).adminUser
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// Simple health check for the admin route itself
// @route GET /api/admin/health
// @desc Checks if admin routes are registered
// @access Public
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Admin route health check OK' });
});

// @route   GET /api/admin/users
// @desc    Get all users (for admin panel) with pagination and search
// @access  Private (Admin)
router.get('/users', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const searchQuery = req.query.search as string || '';
    const sortBy = req.query.sortBy as string || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;

    const query: mongoose.FilterQuery<IUser> = {};
    if (searchQuery) {
      query.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password') // Exclude password
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('profile', 'photos bio lastActive'); // Populate some profile info

    const totalUsers = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// --- Subscription Plan CRUD Endpoints ---

// @route   POST /api/admin/subscription-plans
// @desc    Create a new subscription plan
// @access  Private (Admin)
router.post('/subscription-plans', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const { planId, name, dailyLikeQuota, description, features, price, isActive, order } = req.body;

    // Basic validation
    if (!planId || !name || dailyLikeQuota === undefined || !description) {
      return res.status(400).json({ success: false, message: 'Missing required fields: planId, name, dailyLikeQuota, description' });
    }

    const existingPlan = await SubscriptionPlan.findOne({ planId: planId.toUpperCase() });
    if (existingPlan) {
      return res.status(400).json({ success: false, message: `Plan with planId '${planId}' already exists.` });
    }

    const newPlan = new SubscriptionPlan({
      planId: planId.toUpperCase(),
      name,
      dailyLikeQuota,
      description,
      features: features || [],
      price: price || {}, // Ensure price is an object, even if empty
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
    });

    await newPlan.save();
    res.status(201).json({ success: true, message: 'Subscription plan created successfully', data: newPlan });
  } catch (error: unknown) {
    console.error('Error creating subscription plan:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   GET /api/admin/subscription-plans
// @desc    Get all subscription plans
// @access  Private (Admin)
router.get('/subscription-plans', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ order: 1, name: 1 });
    res.json({ success: true, data: plans });
  } catch (error: unknown) {
    console.error('Error fetching subscription plans:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   GET /api/admin/subscription-plans/:id
// @desc    Get a single subscription plan by its MongoDB _id
// @access  Private (Admin)
router.get('/subscription-plans/:id', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid plan ID format.' });
    }
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }
    res.json({ success: true, data: plan });
  } catch (error: unknown) {
    console.error('Error fetching subscription plan:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   PUT /api/admin/subscription-plans/:id
// @desc    Update a subscription plan by its MongoDB _id
// @access  Private (Admin)
router.put('/subscription-plans/:id', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid plan ID format.' });
    }
    const { planId, name, dailyLikeQuota, description, features, price, isActive, order } = req.body;

    const updateData: Partial<ISubscriptionPlan> = {};
    if (name !== undefined) updateData.name = name;
    if (dailyLikeQuota !== undefined) updateData.dailyLikeQuota = dailyLikeQuota;
    if (description !== undefined) updateData.description = description;
    if (features !== undefined) updateData.features = features;
    if (price !== undefined) updateData.price = price;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = order;
    
    // Handle planId update carefully: ensure new planId is unique if changed
    if (planId !== undefined) {
        const currentPlan = await SubscriptionPlan.findById(req.params.id);
        if (currentPlan && currentPlan.planId !== planId.toUpperCase()) {
            const conflictingPlan = await SubscriptionPlan.findOne({ planId: planId.toUpperCase(), _id: { $ne: req.params.id } });
            if (conflictingPlan) {
                return res.status(400).json({ success: false, message: `Another plan with planId '${planId.toUpperCase()}' already exists.` });
            }
            updateData.planId = planId.toUpperCase();
        } else if (!currentPlan) {
             return res.status(404).json({ success: false, message: 'Subscription plan not found for planId update check' });
        }
    }


    const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }
    res.json({ success: true, message: 'Subscription plan updated successfully', data: updatedPlan });
  } catch (error: unknown) {
    console.error('Error updating subscription plan:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   DELETE /api/admin/subscription-plans/:id
// @desc    Delete a subscription plan by its MongoDB _id
// @access  Private (Admin)
router.delete('/subscription-plans/:id', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid plan ID format.' });
    }
    
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Subscription plan not found' });
    }
    res.json({ success: true, message: 'Subscription plan deleted successfully' });

  } catch (error: unknown) {
    console.error('Error deleting subscription plan:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

export default router;