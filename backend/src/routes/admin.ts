import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose'; // Import mongoose
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User, { IUser, IPhoto } from '../models/User'; // Import User model and IUser interface, IPhoto
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan'; // Import SubscriptionPlan model
import AppSetting, { IAppSetting } from '../models/AppSetting'; // Import AppSetting model
import Match from '../models/Match'; // Import Match model
import { isAdminAuthenticated } from '../middleware/adminAuth'; // Import the new middleware
import { updateDiscoverLimiter, updateProfilesPerPageSetting } from '../routes/userProfile-ts'; // Import updaters
import { getPhotoUrl } from '../services/photoProcessor'; // Import photo URL generator

// Load environment variables
dotenv.config();

const router: Router = express.Router();

// Router-level OPTIONS handler for all /api/admin/* paths
router.options('/*', (req: Request, res: Response) => {
  console.log(`[ADMIN ROUTER OPTIONS HANDLER] Intercepted OPTIONS for ${req.originalUrl} (path within admin: ${req.path})`);
  // Manually set CORS headers - ensure adminPanelOrigin is accessible here or use a fixed value for testing
  // For now, let's assume adminPanelOrigin is available or use a placeholder.
  // Ideally, corsOptions would be passed or re-defined here.
  const adminPanelOrigin = process.env.ADMIN_PANEL_ORIGIN_URL || 'http://localhost:3001';
  res.header('Access-Control-Allow-Origin', adminPanelOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  console.log(`[ADMIN ROUTER OPTIONS HANDLER] Sending 204 for ${req.originalUrl}`);
  res.sendStatus(204);
});


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
          
          console.log('[ADMIN LOGIN] JWT generated successfully. Token:', token ? 'Exists' : 'MISSING!!!');
          const cookieOptions = {
            httpOnly: true,
            secure: true,
            sameSite: 'none' as 'none', // Explicitly type for clarity
            maxAge: 1000 * 60 * 60 * 24 * 7,
            path: '/',
          };
          console.log('[ADMIN LOGIN] Attempting to set cookie with options:', cookieOptions);
          
          // Set HttpOnly cookie containing the JWT
          res.cookie('admin_auth_token', token, cookieOptions);
          
          console.log('[ADMIN LOGIN] Cookie "admin_auth_token" should have been set.');

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
      subscriptionTier: { $ne: 'FREE' },
      $or: [
        { subscriptionExpiresAt: null },
        { subscriptionExpiresAt: { $exists: false } },
        { subscriptionExpiresAt: { $gt: new Date() } }
      ]
    });

    const totalMatches = await Match.countDocuments({ isMatch: true });
    const totalLikes = await Match.countDocuments({ action: 'like' }); // Total like actions recorded

    res.json({
      success: true,
      message: 'Admin stats fetched successfully.',
      data: {
        totalUsers: totalUsers,
        activeSubscriptions: activeSubscribers,
        totalMatches: totalMatches,
        totalLikes: totalLikes, // Using this as a proxy for "likes" stat
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

    const usersFromDB = await User.find(query)
      .select('-password') // Exclude password
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // Use .lean() for plain JS objects, easier to modify

    const totalUsers = await User.countDocuments(query);

    // Manually add some profile information if needed for the admin list
    // Directly use fields from the User model as profile info is merged
    const finalUserData = usersFromDB.map(user => {
      const mainPhoto = user.photos?.find((p: IPhoto) => p.isMain);
      return {
        ...user,
        // profileData is no longer a separate object, access fields directly from user
        mainPhotoUrl: mainPhoto?.filename ? await getPhotoUrl(mainPhoto.filename) :
                     (user.photos?.[0]?.filename ? await getPhotoUrl(user.photos[0].filename) : null),
        bioExcerpt: user.bio?.substring(0, 50) + (user.bio && user.bio.length > 50 ? '...' : ''),
        // lastActive is already on the user model, prioritize it. Fallback to updatedAt.
        lastActive: user.lastActive || user.updatedAt,
      };
    });

    res.json({
      success: true,
      data: finalUserData,
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

// @route   PUT /api/admin/subscription-plans/:id/set-default
// @desc    Set a subscription plan as the default for new users
// @access  Private (Admin)
router.put('/subscription-plans/:id/set-default', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const planIdToSetAsDefault = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(planIdToSetAsDefault)) {
      return res.status(400).json({ success: false, message: 'Invalid plan ID format.' });
    }

    // Start a session for atomic operation
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Set isDefault to false for all other plans
      await SubscriptionPlan.updateMany(
        { _id: { $ne: planIdToSetAsDefault }, isDefault: true },
        { $set: { isDefault: false } },
        { session }
      );

      // Step 2: Set the specified plan as default
      const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
        planIdToSetAsDefault,
        { $set: { isDefault: true, isActive: true } }, // Also ensure the default plan is active
        { new: true, session, runValidators: true }
      );

      if (!updatedPlan) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Subscription plan not found or could not be updated.' });
      }

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, message: `Plan '${updatedPlan.name}' set as default successfully.`, data: updatedPlan });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error setting default subscription plan:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred during the transaction.';
      res.status(500).json({ success: false, message });
    }
  } catch (error: unknown) {
    console.error('Error initiating set default subscription plan operation:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   GET /api/admin/user-quotas
// @desc    Get users with their like quota information
// @access  Private (Admin)
router.get('/user-quotas', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const searchQuery = req.query.search as string || '';
    const sortBy = req.query.sortBy as string || 'name'; // Default sort by name
    const order = req.query.order === 'desc' ? -1 : 1; // Default asc

    const query: mongoose.FilterQuery<IUser> = {};
    if (searchQuery) {
      query.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('name email subscriptionTier dailyLikeQuota remainingLikes likesResetTime')
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

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
    console.error('Error fetching user quotas for admin:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});


// --- App Settings Endpoints ---

const DISCOVER_RATE_LIMIT_KEY = 'discoverRateLimit';
const DEFAULT_DISCOVER_RATE_LIMIT = {
  windowMs: 10 * 1000, // 10 seconds
  max: 5, // 5 requests
  message: 'Too many discovery requests, please try again after 10 seconds.',
};

// @route   GET /api/admin/settings/discover-rate-limit
// @desc    Get the current discover profiles rate limit settings
// @access  Private (Admin)
router.get('/settings/discover-rate-limit', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const setting = await AppSetting.findOne({ key: DISCOVER_RATE_LIMIT_KEY });
    if (setting) {
      res.json({ success: true, data: setting.value });
    } else {
      // If not set, return default values (but don't save them here)
      res.json({ success: true, data: DEFAULT_DISCOVER_RATE_LIMIT, message: 'Using default settings as no custom configuration was found.' });
    }
  } catch (error: unknown) {
    console.error('Error fetching discover rate limit settings:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   PUT /api/admin/settings/discover-rate-limit
// @desc    Update the discover profiles rate limit settings
// @access  Private (Admin)
router.put('/settings/discover-rate-limit', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const { windowMs, max, message } = req.body;

    if (typeof windowMs !== 'number' || typeof max !== 'number') {
      return res.status(400).json({ success: false, message: 'windowMs and max must be numbers.' });
    }
    if (windowMs < 1000 || max < 1) {
        return res.status(400).json({ success: false, message: 'windowMs must be at least 1000ms and max must be at least 1.' });
    }

    const value: any = { windowMs, max };
    if (message && typeof message === 'string') {
      value.message = message;
    } else {
      value.message = DEFAULT_DISCOVER_RATE_LIMIT.message; // Use default message if not provided or invalid
    }
    
    const updatedSetting = await AppSetting.findOneAndUpdate(
      { key: DISCOVER_RATE_LIMIT_KEY },
      {
        value,
        description: 'Rate limit settings for the discover profiles endpoint. Value contains { windowMs: milliseconds, max: requests, message: string }.'
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, message: 'Discover rate limit settings updated successfully.', data: updatedSetting.value });
  } catch (error: unknown) {
    console.error('Error updating discover rate limit settings:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   POST /api/admin/settings/refresh-discover-rate-limit
// @desc    Refreshes the discover settings (rate limiter & profiles per page) from the database
// @access  Private (Admin)
router.post('/settings/refresh-discover-settings', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    await updateDiscoverLimiter(); // Refresh rate limit settings
    await updateProfilesPerPageSetting(); // Refresh profiles per page setting
    res.json({ success: true, message: 'Discovery settings (rate limit and profiles per page) have been refreshed.' });
  } catch (error: unknown) {
    console.error('Error refreshing discovery settings:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred while refreshing discovery settings.';
    res.status(500).json({ success: false, message });
  }
});


// --- Profiles Per Page Settings ---
// Key must match the one in userProfile-ts.ts
const PROFILES_PER_PAGE_KEY_ADMIN = 'discoverProfilesPerPage';
const DEFAULT_PROFILES_PER_PAGE_ADMIN_FALLBACK = 5; // Fallback if not in DB

// @route   GET /api/admin/settings/profiles-per-page
// @desc    Get the current profiles per page setting for discovery
// @access  Private (Admin)
router.get('/settings/profiles-per-page', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const setting = await AppSetting.findOne({ key: PROFILES_PER_PAGE_KEY_ADMIN });
    if (setting && setting.value && typeof setting.value.count === 'number') {
      res.json({ success: true, data: { count: setting.value.count } });
    } else {
      // If not set, return default values (but don't save them here)
      res.json({
        success: true,
        data: { count: DEFAULT_PROFILES_PER_PAGE_ADMIN_FALLBACK },
        message: 'No setting found in DB, returning default.'
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching profiles per page setting:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   PUT /api/admin/settings/profiles-per-page
// @desc    Update the profiles per page setting for discovery
// @access  Private (Admin)
router.put('/settings/profiles-per-page', isAdminAuthenticated, async (req: Request, res: Response) => {
  const { count } = req.body;

  if (typeof count !== 'number' || count <= 0 || !Number.isInteger(count)) {
    return res.status(400).json({ success: false, message: 'Invalid input: count must be a positive integer.' });
  }

  try {
    const newSettingValue = { count }; // Store as { value: { count: X } }

    const updatedSetting = await AppSetting.findOneAndUpdate(
      { key: PROFILES_PER_PAGE_KEY_ADMIN },
      {
        key: PROFILES_PER_PAGE_KEY_ADMIN,
        value: newSettingValue, // This will be stored under the 'value' field of AppSetting
        description: 'Number of profiles to return per page in discovery feed.'
      },
      { upsert: true, new: true, runValidators: true }
    );

    await updateProfilesPerPageSetting(); // Trigger update in userProfile-ts.ts to use the new value

    res.json({
      success: true,
      message: 'Profiles per page setting updated successfully!',
      data: updatedSetting.value // Return the 'value' object which contains 'count'
    });
  } catch (error: unknown) {
    console.error('Error updating profiles per page setting:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});


// --- Redis Heartbeat Settings ---
const REDIS_HEARTBEAT_KEY = 'redisHeartbeatEnabled';

// @route   GET /api/admin/settings/redis-heartbeat
// @desc    Get the current Redis heartbeat setting
// @access  Private (Admin)
router.get('/settings/redis-heartbeat', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const setting = await AppSetting.findOne({ key: REDIS_HEARTBEAT_KEY });
    const enabled = setting?.value?.enabled || false;
    res.json({ success: true, enabled });
  } catch (error: unknown) {
    console.error('Error fetching Redis heartbeat setting:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

// @route   PUT /api/admin/settings/redis-heartbeat
// @desc    Update the Redis heartbeat setting
// @access  Private (Admin)
router.put('/settings/redis-heartbeat', isAdminAuthenticated, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled must be a boolean value.' });
    }

    const updatedSetting = await AppSetting.findOneAndUpdate(
      { key: REDIS_HEARTBEAT_KEY },
      {
        key: REDIS_HEARTBEAT_KEY,
        value: { enabled },
        description: 'Enable/disable Redis connection heartbeat monitoring'
      },
      { upsert: true, new: true }
    );

    // Import and call the heartbeat toggle function
    const { toggleRedisHeartbeat } = await import('../routes/userProfile-ts');
    await toggleRedisHeartbeat(enabled);

    res.json({
      success: true,
      message: `Redis heartbeat ${enabled ? 'enabled' : 'disabled'} successfully.`,
      enabled
    });
  } catch (error: unknown) {
    console.error('Error updating Redis heartbeat setting:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    res.status(500).json({ success: false, message });
  }
});

export default router;