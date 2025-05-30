import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import Match, { IMatch, MatchAction } from '../models/Match';
import User, { IUser, IPhoto, ILikeData, IRejectData } from '../models/User'; // Updated to use User model and its types
import { protect } from '../middleware/auth';
import { isAdmin } from '../middleware/admin';
import { checkAndResetQuota } from './subscription';

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser;
}

// Create router instance
const router: Router = express.Router();

// @route   POST /api/matches/action
// @desc    Register an action (like or pass)
// @access  Private
router.post('/action', protect, async (req: AuthRequest, res: Response) => {
  console.log('==================================================');
  console.log(`ACTION REQUEST - ${new Date().toISOString()}`);
  console.log('User:', req.user?._id);
  console.log('Request:', req.body);
  console.log('User remaining likes BEFORE:', req.user?.remainingLikes);
  console.log('User dailyLikeQuota:', req.user?.dailyLikeQuota);
  console.log('==================================================');
  
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    const { targetUserId, action } = req.body as { targetUserId: string, action: MatchAction };

    // Validate action
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    if (!action || (action !== 'like' && action !== 'pass')) {
      return res.status(400).json({
        success: false,
        message: 'Valid action (like or pass) is required'
      });
    }

    // Only check quota for like actions
    if (action === 'like') {
      // Check quota using the centralized function
      await checkAndResetQuota(req.user);
      
      // Check if user has remaining likes
      if (req.user.remainingLikes <= 0) {
        console.log('User has NO remaining likes, returning error');
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
    }

    // Make sure user isn't acting on their own profile
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform action on your own profile'
      });
    }

    // MongoDB ObjectId validation - Check if it's a valid ID
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      console.log(`[DEBUG] Invalid ObjectID: ${targetUserId}, handling as test profile ID`);
      
      if (action === 'like') {
        try {
          // Directly decrement like count instead of making HTTP request
          req.user.remainingLikes = Math.max(0, req.user.remainingLikes - 1);
          await req.user.save();
          
          console.log(`[TEST PROFILE] Like consumed, remaining: ${req.user.remainingLikes}`);
          
          return res.json({
            success: true,
            match: {
              targetUser: targetUserId,
              action,
              isMatch: false 
            },
            quotaInfo: result.data.quotaInfo
          });
        } catch (error: unknown) {
          console.error('Error consuming like for test profile:', error);
          return res.status(500).json({
            success: false,
            message: 'Error processing like action',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return res.json({
        success: true,
        match: {
          targetUser: targetUserId,
          action,
          isMatch: false 
        }
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      // This should ideally not happen due to 'protect' middleware
      return res.status(404).json({ success: false, message: 'Current user not found' });
    }
    
    // Ensure profile-related fields are initialized for the current user if they are interacting
    currentUser.location = currentUser.location || { type: 'Point', coordinates: [0,0], city: 'Unknown', country: 'Unknown' };
    currentUser.preferences = currentUser.preferences || { ageRange: {min: 18, max: 100}, distance: 50};
    currentUser.likedBy = currentUser.likedBy || [];
    currentUser.rejected = currentUser.rejected || [];
    currentUser.photos = currentUser.photos || [];
    await currentUser.save(); // Save if any defaults were set

    let existingMatch = await Match.findOne({
      user: currentUser._id,
      targetUser: targetUser._id
    });

    let actionResult: IMatch;

    if (existingMatch) {
      if (existingMatch.action === action) {
        console.log(`[ACTION ALREADY EXISTS] Action ${action} for target ${targetUser._id} by ${currentUser._id} already registered, not changing quota`);
        let quotaInfo = {
          remaining: currentUser.remainingLikes,
          total: currentUser.dailyLikeQuota,
          resetTime: currentUser.likesResetTime
        };
        return res.json({
          success: true,
          match: existingMatch,
          message: `Action ${action} was already registered`,
          quotaInfo
        });
      }

      existingMatch.action = action as MatchAction;
      if (action === 'pass' && existingMatch.isMatch) {
        existingMatch.isMatch = false; // Unmatch if passing on an existing match
        existingMatch.matchedAt = undefined;
      }
      await existingMatch.save();
      actionResult = existingMatch;
    } else {
      actionResult = await Match.create({
        user: currentUser._id,
        targetUser: targetUser._id,
        action
      });
    }

    if (action === 'like') {
      const mutualMatch = await Match.findOne({
        user: targetUser._id,
        targetUser: currentUser._id,
        action: 'like'
      });

      if (mutualMatch) {
        actionResult.isMatch = true;
        actionResult.matchedAt = new Date();
        await actionResult.save();

        mutualMatch.isMatch = true;
        mutualMatch.matchedAt = new Date();
        await mutualMatch.save();

        // Add to targetUser's likedBy array
        targetUser.likedBy = targetUser.likedBy || [];
        const alreadyLikedByTarget = targetUser.likedBy.some(
          (like: ILikeData) => like.user && like.user.toString() === currentUser._id.toString()
        );
        if (!alreadyLikedByTarget) {
          targetUser.likedBy.push({
            user: currentUser._id, // Current user liked the target
            likedAt: new Date()
          } as ILikeData); // Cast to ILikeData
          await targetUser.save();
        }
        
        // Add to currentUser's likedBy array (reciprocal, though action is initiated by current user)
        // This might be redundant if we only care about who liked whom.
        // For now, let's assume `likedBy` means "users who have liked me".
        // The match document itself signifies the current user's like.

        let quotaInfo;
        try {
          // Directly decrement like count instead of making HTTP request
          currentUser.remainingLikes = Math.max(0, currentUser.remainingLikes - 1);
          await currentUser.save();
          
          quotaInfo = {
            remaining: currentUser.remainingLikes,
            total: currentUser.dailyLikeQuota,
            resetTime: currentUser.likesResetTime
          };
          
          console.log(`[MUTUAL MATCH] Like consumed, remaining: ${currentUser.remainingLikes}`);
        } catch (error: unknown) {
          console.error('Error consuming like for mutual match:', error);
          return res.status(500).json({
            success: false,
            message: 'Error processing like action',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        return res.json({
          success: true,
          match: actionResult,
          isNewMatch: true,
          message: "It's a match!",
          quotaInfo
        });
      } else {
        // Not a mutual match yet, just record the like in targetUser's likedBy
        targetUser.likedBy = targetUser.likedBy || [];
         const alreadyLikedByTarget = targetUser.likedBy.some(
          (like: ILikeData) => like.user && like.user.toString() === currentUser._id.toString()
        );
        if (!alreadyLikedByTarget) {
            targetUser.likedBy.push({
                user: currentUser._id, // Current user liked the target
                likedAt: new Date()
            } as ILikeData);
            await targetUser.save();
        }
      }
    } else if (action === 'pass') {
      // Record the rejection in the current user's rejected list
      currentUser.rejected = currentUser.rejected || [];
      const alreadyRejected = currentUser.rejected.some(
        (rejection: IRejectData) => rejection.user && rejection.user.toString() === targetUser._id.toString()
      );

      if (!alreadyRejected) {
        currentUser.rejected.push({
          user: targetUser._id, // Target user was rejected by current user
          rejectedAt: new Date()
        } as IRejectData);
        await currentUser.save();
      }
    }

    if (action === 'like') {
      try {
        // Directly decrement like count instead of making HTTP request
        currentUser.remainingLikes = Math.max(0, currentUser.remainingLikes - 1);
        await currentUser.save();
        
        const quotaInfo = {
          remaining: currentUser.remainingLikes,
          total: currentUser.dailyLikeQuota,
          resetTime: currentUser.likesResetTime
        };
        
        console.log(`[REGULAR LIKE] Like consumed, remaining: ${currentUser.remainingLikes}`);
        return res.json({
          success: true,
          match: actionResult,
          message: `Action ${action} registered successfully`,
          quotaInfo: quotaInfo
        });
      } catch (error: unknown) {
        console.error('Error consuming like:', error);
        return res.status(500).json({
          success: false,
          message: 'Error processing like action',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else {
      return res.json({
        success: true,
        match: actionResult,
        message: `Action ${action} registered successfully`
      });
    }
  } catch (error: unknown) {
    console.error('Match action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage
    });
  }
});

// @route   GET /api/matches
// @desc    Get all matches for the current user
// @access  Private
router.get('/', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    const matches = await Match.find({
      user: req.user._id,
      isMatch: true
    }).sort({ matchedAt: -1 });

    if (matches.length === 0) {
      return res.json({
        success: true,
        matches: [],
        message: 'No matches found'
      });
    }

    const targetUserIds = matches.map((match: IMatch) => match.targetUser);
    
    const targetUsers = await User.find({
      _id: { $in: targetUserIds }
    }).select('_id name photos lastActive'); // Fetch necessary fields directly from User

    const userMap = new Map<string, IUser>();
    targetUsers.forEach((user: IUser) => {
      userMap.set(user._id.toString(), user);
    });

    const populatedMatches = matches.map((match: IMatch) => {
      const targetUserData = userMap.get(match.targetUser.toString());
      const mainPhoto = targetUserData?.photos?.find((p: IPhoto) => p.isMain);

      return {
        _id: match._id,
        targetUser: {
          _id: match.targetUser,
          name: targetUserData?.name || 'Unknown User',
          photo: mainPhoto ? mainPhoto.url : null,
          lastActive: targetUserData?.lastActive
        },
        matchedAt: match.matchedAt,
        createdAt: match.createdAt // Include createdAt if needed by client
      };
    });

    res.json({
      success: true,
      matches: populatedMatches
    });
  } catch (error: unknown) {
    console.error('Get matches error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage
    });
  }
});

// @route   GET /api/matches/likes
// @desc    Get all profiles that liked the current user
// @access  Private
router.get('/likes', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId)
        .populate<{ likedBy: { user: IUser, likedAt: Date }[] }>({ // Populate the user field within likedBy
            path: 'likedBy.user', // Path to populate within the likedBy array
            select: 'name dateOfBirth gender photos' // Fields to select from the User who liked
        });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'Current user not found'
      });
    }

    // Ensure likedBy array exists, even if empty
    currentUser.likedBy = currentUser.likedBy || [];

    if (currentUser.likedBy.length === 0) {
      return res.json({
        success: true,
        likes: [],
        message: 'No one has liked your profile yet'
      });
    }

    // Format the response
    const likesResponse = currentUser.likedBy
      .filter(likeEntry => likeEntry.user) // Ensure the user who liked is populated
      .map((likeEntry) => {
        const liker = likeEntry.user as IUser; // The user who performed the like
        const mainPhoto = liker.photos?.find((p: IPhoto) => p.isMain);

        let age;
        if (liker.dateOfBirth) {
            const birthDate = new Date(liker.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        return {
          _id: liker._id, // ID of the user who liked
          name: liker.name,
          age: age,
          gender: liker.gender,
          photo: mainPhoto ? mainPhoto.url : null,
          likedAt: likeEntry.likedAt // Timestamp when the like occurred
        };
      });

    // Sort by most recent likes
    const sortedLikes = likesResponse.sort((a, b) => {
        const dateA = a.likedAt ? new Date(a.likedAt).getTime() : 0;
        const dateB = b.likedAt ? new Date(b.likedAt).getTime() : 0;
        return dateB - dateA;
    });

    res.json({
      success: true,
      likes: sortedLikes
    });
  } catch (error: unknown) {
    console.error('Get likes error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: errorMessage
    });
  }
});

// @route   GET /api/matches/quota
// @desc    Get the user's current like quota status
// @access  Private
router.get('/quota', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    await checkAndResetQuota(req.user);

    const now = new Date();
    const timeUntilReset = req.user.likesResetTime.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(timeUntilReset / (1000 * 60 * 60));
    const minutesUntilReset = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));

    return res.json({
      success: true,
      quotaInfo: {
        remaining: req.user.remainingLikes,
        total: req.user.dailyLikeQuota,
        resetTime: req.user.likesResetTime,
        timeUntilReset: {
          hours: hoursUntilReset,
          minutes: minutesUntilReset,
          milliseconds: timeUntilReset
        }
      }
    });
  } catch (error: unknown) {
    console.error('Get quota error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching quota information',
      error: errorMessage
    });
  }
});

// @route   PUT /api/matches/admin/quota/:userId
// @desc    Update a user's like quota (admin only)
// @access  Admin
router.put('/admin/quota/:userId', protect, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { dailyLikeQuota, remainingLikes } = req.body as { dailyLikeQuota?: string | number, remainingLikes?: string | number };

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (dailyLikeQuota !== undefined) {
      userToUpdate.dailyLikeQuota = parseInt(String(dailyLikeQuota), 10);
    }
    if (remainingLikes !== undefined) {
      userToUpdate.remainingLikes = parseInt(String(remainingLikes), 10);
    }
    
    if (dailyLikeQuota !== undefined || remainingLikes !== undefined) {
        userToUpdate.likesResetTime = new Date(0); 
    }

    await userToUpdate.save();

    res.json({
      success: true,
      message: 'User quota updated successfully',
      user: {
        _id: userToUpdate._id,
        dailyLikeQuota: userToUpdate.dailyLikeQuota,
        remainingLikes: userToUpdate.remainingLikes,
        likesResetTime: userToUpdate.likesResetTime
      }
    });
  } catch (error: unknown) {
    console.error('Admin update quota error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error updating user quota',
      error: errorMessage
    });
  }
});

// Test route
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Matches test route is working!' });
});

export default router;
