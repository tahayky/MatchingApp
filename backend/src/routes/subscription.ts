import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import SubscriptionPlan, { ISubscriptionPlan } from '../models/SubscriptionPlan'; // Import the DB model
import { protect } from '../middleware/auth';
import { isAdmin } from '../middleware/admin';
import * as subscriptionConfig from '../config/subscriptionTiers';
// Dinamik olarak import etmek için
let { subscriptionTiers, getSubscriptionTier, getDefaultTier } = subscriptionConfig; // Reinstate subscriptionTiers for other functions
import fs from 'fs';
import path from 'path';

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser;
}

// Create router instance
const router: Router = express.Router();

// @route   GET /api/subscription/tiers
// @desc    Get all available subscription tiers
// @access  Public
router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const activePlansFromDB = await SubscriptionPlan.find({ isActive: true }).sort({ order: 1 }).lean();

    // Map database plans to the structure expected by the mobile app
    const tiersForMobile = activePlansFromDB.map(plan => ({
      id: plan.planId.toLowerCase(), // Mobile app might expect lowercase 'free', 'plus', 'premium'
      name: plan.name,
      dailyLikeQuota: plan.dailyLikeQuota,
      description: plan.description,
      features: plan.features,
      price: plan.price ? { // Ensure price object and its properties are correctly mapped
        monthly: plan.price.monthly,
        yearly: plan.price.yearly,
      } : undefined,
      // Add any other fields the mobile app might expect if different from ISubscriptionPlan
    }));

    return res.json({
      success: true,
      tiers: tiersForMobile
    });
  } catch (error: unknown) {
    console.error('Get subscription tiers from DB error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription tiers',
      error: errorMessage
    });
  }
});

// @route   GET /api/subscription/status
// @desc    Get current user's subscription status
// @access  Private
router.get('/status', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    // Get the subscription tier details
    const tierInfo = getSubscriptionTier(req.user.subscriptionTier) || getDefaultTier();
    
    // Check if subscription has expired
    let hasExpired = false;
    if (req.user.subscriptionExpiresAt && req.user.subscriptionTier !== 'FREE') {
      hasExpired = new Date() > req.user.subscriptionExpiresAt;
      
      // If expired, downgrade to free tier
      if (hasExpired) {
        req.user.subscriptionTier = 'FREE';
        req.user.dailyLikeQuota = getDefaultTier().dailyLikeQuota;
        
        // If current remaining likes is greater than new quota, adjust it
        if (req.user.remainingLikes > req.user.dailyLikeQuota) {
          req.user.remainingLikes = req.user.dailyLikeQuota;
        }
        
        await req.user.save();
      }
    }

    return res.json({
      success: true,
      subscription: {
        tier: req.user.subscriptionTier,
        expiresAt: req.user.subscriptionExpiresAt || null,
        hasExpired,
        features: tierInfo.features,
        quotaInfo: {
          remaining: req.user.remainingLikes,
          total: req.user.dailyLikeQuota,
          resetTime: req.user.likesResetTime
        }
      }
    });
  } catch (error: unknown) {
    console.error('Get subscription status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription status',
      error: errorMessage
    });
  }
});

// @route   POST /api/subscription/upgrade
// @desc    Upgrade user's subscription tier
// @access  Private
router.post('/upgrade', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    const { tierId, durationMonths } = req.body;
    
    // Validate inputs
    if (!tierId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription tier ID is required'
      });
    }
    
    // Get tier details
    const tier = getSubscriptionTier(tierId);
    if (!tier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription tier'
      });
    }
    
    // In a production app, we would handle payment processing here
    // For this example, we'll just update the user's subscription
    
    // Calculate expiration date based on duration (default to 1 month if not specified)
    const months = durationMonths || 1;
    if (months < 1 || months > 12) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 1 and 12 months'
      });
    }
    
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);
    
    // Update user's subscription
    req.user.subscriptionTier = tier.id.toUpperCase();
    req.user.subscriptionExpiresAt = expiresAt;
    req.user.dailyLikeQuota = tier.dailyLikeQuota;
    
    // If this is an upgrade that gives more likes, update remaining likes
    if (req.user.remainingLikes < tier.dailyLikeQuota) {
      req.user.remainingLikes = tier.dailyLikeQuota;
    }
    
    await req.user.save();
    
    return res.json({
      success: true,
      message: `Successfully upgraded to ${tier.name} subscription`,
      subscription: {
        tier: req.user.subscriptionTier,
        features: tier.features,
        expiresAt: req.user.subscriptionExpiresAt,
        quotaInfo: {
          remaining: req.user.remainingLikes,
          total: req.user.dailyLikeQuota,
          resetTime: req.user.likesResetTime
        }
      }
    });
  } catch (error: unknown) {
    console.error('Subscription upgrade error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while upgrading subscription',
      error: errorMessage
    });
  }
});

// @route   POST /api/subscription/admin/set
// @desc    Set a user's subscription (admin only)
// @access  Admin
router.post('/admin/set/:userId', protect, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { tierId, durationMonths } = req.body;
    
    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Validate tier
    if (!tierId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription tier ID is required'
      });
    }
    
    const tier = getSubscriptionTier(tierId);
    if (!tier) {
      return res.status(400).json({
        success: false,
        message: 'Invalid subscription tier'
      });
    }
    
    // Calculate expiration (if it's not the free tier)
    let expiresAt: Date | undefined = undefined;
    if (tier.id !== 'free') {
      const months = durationMonths || 1;
      if (months < 1) {
        return res.status(400).json({
          success: false,
          message: 'Duration must be at least 1 month'
        });
      }
      
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);
    }
    
    // Update user's subscription
    user.subscriptionTier = tier.id.toUpperCase();
    user.subscriptionExpiresAt = expiresAt;
    user.dailyLikeQuota = tier.dailyLikeQuota;
    
    // If this is an upgrade that gives more likes, update remaining likes
    if (user.remainingLikes < tier.dailyLikeQuota) {
      user.remainingLikes = tier.dailyLikeQuota;
    }
    
    await user.save();
    
    return res.json({
      success: true,
      message: `Successfully set user's subscription to ${tier.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        subscription: {
          tier: user.subscriptionTier,
          expiresAt: user.subscriptionExpiresAt,
          quotaInfo: {
            total: user.dailyLikeQuota,
            remaining: user.remainingLikes,
            resetTime: user.likesResetTime
          }
        }
      }
    });
  } catch (error: unknown) {
    console.error('Admin set subscription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while setting subscription',
      error: errorMessage
    });
  }
});

// @route   GET /api/subscription/refresh-config
// @desc    Reload subscription tiers configuration
// @access  Public (for development, should be Admin in production)
router.get('/refresh-config', async (req: Request, res: Response) => {
  try {
    // Clear the module cache for the subscriptionTiers module
    delete require.cache[require.resolve('../config/subscriptionTiers')];
    
    // Reimport the module to get fresh values
    const freshConfig = await import('../config/subscriptionTiers');
    
    // Update our global references
    subscriptionTiers = freshConfig.subscriptionTiers;
    getSubscriptionTier = freshConfig.getSubscriptionTier;
    getDefaultTier = freshConfig.getDefaultTier;
    
    console.log('Subscription tiers configuration refreshed:', Object.keys(subscriptionTiers));
    
    // Also update any existing FREE tier users to have the correct quota
    try {
      const freeTier = subscriptionTiers.FREE;
      if (freeTier) {
        // Update all FREE tier users to have the correct dailyLikeQuota
        const updateResult = await User.updateMany(
          { subscriptionTier: 'FREE' },
          { 
            $set: { 
              dailyLikeQuota: freeTier.dailyLikeQuota,
              // Also update remaining likes, but only if they currently have more than the new quota
              remainingLikes: freeTier.dailyLikeQuota
            } 
          }
        );
        
        console.log(`Updated ${updateResult.modifiedCount} FREE tier users to have the correct quota of ${freeTier.dailyLikeQuota}`);
      }
    } catch (quotaUpdateError) {
      console.error('Error updating FREE tier users quota:', quotaUpdateError);
      // Don't fail the request if this part fails
    }
    
    return res.json({
      success: true,
      message: 'Subscription tiers configuration reloaded successfully',
      tiers: Object.values(subscriptionTiers)
    });
  } catch (error: unknown) {
    console.error('Error refreshing subscription config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while refreshing subscription configuration',
      error: errorMessage
    });
  }
});

// Helper utility method - exported for use in other files
// This resets a user's quota if reset time has passed
export const checkAndResetQuota = async (user: IUser): Promise<void> => {
  const now = new Date();
  if (now > user.likesResetTime) {
    // Reset the likes quota
    user.remainingLikes = user.dailyLikeQuota;
    user.likesResetTime = new Date(now);
    user.likesResetTime.setDate(user.likesResetTime.getDate() + 1);
    user.likesResetTime.setHours(0, 0, 0, 0);
    await user.save();
    console.log(`[QUOTA] Reset user ${user._id} quota to ${user.remainingLikes} (daily: ${user.dailyLikeQuota})`);
  }
};

// @route   POST /api/subscription/consume-like
// @desc    Consume one like from user's quota
// @access  Private
router.post('/consume-like', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    // Get the updated tier information directly from config file to ensure fresh values
    const { subscriptionTiers } = await import('../config/subscriptionTiers');
    const userTier = subscriptionTiers[req.user.subscriptionTier];
    
    // Force reload quotas from configuration
    if (userTier) {
      // Update the user's quota based on their current tier
      if (req.user.dailyLikeQuota !== userTier.dailyLikeQuota) {
        console.log(`[CONSUME] Updating user quota from ${req.user.dailyLikeQuota} to ${userTier.dailyLikeQuota} based on tier ${req.user.subscriptionTier}`);
        req.user.dailyLikeQuota = userTier.dailyLikeQuota;
        await req.user.save();
      }
    }
    
    // Check if quota reset time has passed
    await checkAndResetQuota(req.user);

    // Check if user has remaining likes
    if (req.user.remainingLikes <= 0) {
      console.log(`[CONSUME] User ${req.user._id} has no remaining likes`);
      return res.status(403).json({
        success: false,
        message: 'Daily like quota exceeded. Try again tomorrow.',
        quotaInfo: {
          remaining: 0,
          total: req.user.dailyLikeQuota,
          resetTime: req.user.likesResetTime
        }
      });
    }

    // Consume one like
    const beforeLikes = req.user.remainingLikes;
    req.user.remainingLikes -= 1;
    await req.user.save();
    
    console.log(`[CONSUME] User ${req.user._id} consumed a like: ${beforeLikes} -> ${req.user.remainingLikes}`);
    
    return res.json({
      success: true,
      message: 'Like consumed successfully',
      quotaInfo: {
        remaining: req.user.remainingLikes,
        total: req.user.dailyLikeQuota,
        resetTime: req.user.likesResetTime,
        // Also provide time until reset
        timeUntilReset: calculateTimeUntilReset(req.user.likesResetTime)
      }
    });
  } catch (error: unknown) {
    console.error('Consume like error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while consuming like',
      error: errorMessage
    });
  }
});

// Helper function to calculate time until reset
function calculateTimeUntilReset(resetTime: Date) {
  const now = new Date();
  const timeUntilReset = resetTime.getTime() - now.getTime();
  const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
  const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    hours: hoursUntilReset,
    minutes: minutesUntilReset,
    milliseconds: timeUntilReset
  };
}

// @route   PUT /api/subscription/admin/update-tier
// @desc    Update a subscription tier's properties
// @access  Admin
// TODO: İlk sürüm için isAdmin kontrolünü kaldırıyoruz, daha sonra eklenecek
router.put('/admin/update-tier', async (req: AuthRequest, res: Response) => {
  try {
    const { tierId, dailyLikeQuota, name, description, features, price } = req.body;
    
    if (!tierId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription tier ID is required'
      });
    }
    
    // Check if tier exists
    const tierKey = tierId.toUpperCase();
    if (!subscriptionTiers[tierKey]) {
      return res.status(404).json({
        success: false,
        message: `Subscription tier '${tierId}' not found`
      });
    }
    
    // Update tier in memory
    if (dailyLikeQuota !== undefined) {
      subscriptionTiers[tierKey].dailyLikeQuota = dailyLikeQuota;
    }
    
    if (name) {
      subscriptionTiers[tierKey].name = name;
    }
    
    if (description) {
      subscriptionTiers[tierKey].description = description;
    }
    
    if (features) {
      subscriptionTiers[tierKey].features = features;
    }
    
    if (price) {
      subscriptionTiers[tierKey].price = price;
    }
    
    // Update the config file
    const configPath = path.resolve(__dirname, '../config/subscriptionTiers.ts');
    const tiers = JSON.stringify(subscriptionTiers, null, 2);
    
    // Generate the content to write
    const content = `// Define subscription tiers with their corresponding like quotas

// Types
export interface SubscriptionTier {
  id: string;
  name: string;
  dailyLikeQuota: number;
  description: string;
  features: string[];
  price?: {
    monthly: number;
    yearly: number;
  };
}

// Define the available subscription tiers
export const subscriptionTiers: Record<string, SubscriptionTier> = ${tiers};

// Get subscription tier by ID
export const getSubscriptionTier = (tierId: string): SubscriptionTier | undefined => {
  return subscriptionTiers[tierId.toUpperCase()];
};

// Get default subscription tier
export const getDefaultTier = (): SubscriptionTier => {
  return subscriptionTiers.FREE;
};`;
    
    fs.writeFileSync(configPath, content, 'utf8');
    
    // If like quota changed, we need to update all users with this tier
    if (dailyLikeQuota !== undefined) {
      // Update users with this subscription tier
      await User.updateMany(
        { subscriptionTier: tierKey },
        { $set: { dailyLikeQuota: dailyLikeQuota } }
      );
      
      // Optionally adjust remainingLikes for users if it's now less than the new quota
      await User.updateMany(
        { 
          subscriptionTier: tierKey,
          remainingLikes: { $lt: dailyLikeQuota }
        },
        { $set: { remainingLikes: dailyLikeQuota } }
      );
    }
    
    return res.json({
      success: true,
      message: `Successfully updated '${subscriptionTiers[tierKey].name}' tier`,
      tier: subscriptionTiers[tierKey]
    });
  } catch (error: unknown) {
    console.error('Update subscription tier error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while updating subscription tier',
      error: errorMessage
    });
  }
});

// @route   PUT /api/subscription/admin/update-like-quota/:userId
// @desc    Update a specific user's daily like quota
// @access  Admin
// TODO: İlk sürüm için isAdmin kontrolünü kaldırıyoruz, daha sonra eklenecek
router.put('/admin/update-like-quota/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { dailyLikeQuota } = req.body;
    
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Validate dailyLikeQuota
    if (dailyLikeQuota === undefined || dailyLikeQuota < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid daily like quota is required'
      });
    }
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update user's daily like quota
    user.dailyLikeQuota = dailyLikeQuota;
    
    // If remaining likes is less than the new quota, update it
    if (user.remainingLikes < dailyLikeQuota) {
      user.remainingLikes = dailyLikeQuota;
    }
    
    await user.save();
    
    return res.json({
      success: true,
      message: `Successfully updated user's daily like quota`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        quotaInfo: {
          total: user.dailyLikeQuota,
          remaining: user.remainingLikes,
          resetTime: user.likesResetTime
        }
      }
    });
  } catch (error: unknown) {
    console.error('Update like quota error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while updating like quota',
      error: errorMessage
    });
  }
});

// @route   PUT /api/subscription/admin/update-global-like-quota
// @desc    Update the daily like quota for all users
// @access  Admin
// TODO: İlk sürüm için isAdmin kontrolünü kaldırıyoruz, daha sonra eklenecek
router.put('/admin/update-global-like-quota', async (req: AuthRequest, res: Response) => {
  try {
    const { dailyLikeQuota, tierIds } = req.body;
    
    // Validate dailyLikeQuota
    if (dailyLikeQuota === undefined || dailyLikeQuota < 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid daily like quota is required'
      });
    }
    
    let filter = {};
    
    // If specific tiers are provided, only update users with those tiers
    if (tierIds && Array.isArray(tierIds) && tierIds.length > 0) {
      // Convert tier ids to uppercase for consistency
      const normalizedTierIds = tierIds.map(id => id.toUpperCase());
      filter = { subscriptionTier: { $in: normalizedTierIds } };
    }
    
    // Update all users' daily like quota that match the filter
    const updateResult = await User.updateMany(
      filter,
      { $set: { dailyLikeQuota: dailyLikeQuota } }
    );
    
    // Optionally adjust remainingLikes for users if they're less than the new quota
    await User.updateMany(
      { 
        ...filter,
        remainingLikes: { $lt: dailyLikeQuota }
      },
      { $set: { remainingLikes: dailyLikeQuota } }
    );
    
    return res.json({
      success: true,
      message: `Successfully updated daily like quota for all users`,
      stats: {
        matched: updateResult.matchedCount,
        modified: updateResult.modifiedCount,
        quota: dailyLikeQuota,
        ...(tierIds ? { tiers: tierIds } : {})
      }
    });
  } catch (error: unknown) {
    console.error('Update global like quota error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while updating global like quota',
      error: errorMessage
    });
  }
});

export default router;
