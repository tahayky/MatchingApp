import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import Match, { IMatch, MatchAction } from '../models/Match';
import Profile, { IProfile, IPhoto, IProfileLike as ProfileLikeInfo, IProfileReject } from '../models/Profile'; // Added IProfileLike, IProfileReject
import User, { IUser } from '../models/User';
import { protect } from '../middleware/auth';
import { isAdmin } from '../middleware/admin';
import axios from 'axios';
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
          const result = await axios.post('http://localhost:3000/api/subscription/consume-like', {}, {
            headers: {
              'Authorization': req.headers.authorization || ''
            }
          });
          
          console.log(`[TEST PROFILE] Quota endpoint consumed a like, remaining: ${result.data.quotaInfo.remaining}`);
          
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

    const targetProfile = await Profile.findById(targetUserId);
    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'Target profile not found'
      });
    }
    
    const profileUserId = targetProfile.user;
    const targetUser = await User.findById(profileUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user associated with the profile not found'
      });
    }

    let currentUserProfile = await Profile.findOne({ user: req.user._id });
    
    if (!currentUserProfile) {
      console.log(`[DEBUG] Current user (${req.user._id}) does not have a profile, creating in action endpoint`);
      try {
        currentUserProfile = await Profile.findOneAndUpdate(
          { user: req.user._id },
          { 
            $setOnInsert: {
              user: req.user._id,
              location: {
                type: 'Point',
                coordinates: [0, 0] as [number, number],
                city: 'Unknown',
                country: 'Unknown'
              },
              likedBy: [] as ProfileLikeInfo[],
              rejected: [] as IProfileReject[],
              lastActive: new Date(),
              createdAt: new Date()
            }
          },
          { 
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
          }
        );
        
        if (!currentUserProfile) {
          throw new Error('Failed to create user profile');
        }
        console.log(`[DEBUG] Created profile for user ${req.user._id} in action endpoint: ${currentUserProfile._id}`);
      } catch (profileError: unknown) {
        console.error('Error creating profile in action endpoint:', profileError);
        const message = profileError instanceof Error ? profileError.message : 'Unknown error creating profile';
        return res.status(500).json({
          success: false, 
          message: 'Error creating user profile',
          error: message
        });
      }
    }

    let existingMatch = await Match.findOne({
      user: req.user._id,
      targetUser: profileUserId
    });
    
    let actionResult: IMatch;

    if (existingMatch) {
      if (existingMatch.action === action) {
        console.log(`[ACTION ALREADY EXISTS] Action ${action} already registered, not changing quota`);
        let quotaInfo = {
          remaining: req.user.remainingLikes,
          total: req.user.dailyLikeQuota,
          resetTime: req.user.likesResetTime
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
        existingMatch.isMatch = false;
        existingMatch.matchedAt = undefined;
      }
      await existingMatch.save();
      actionResult = existingMatch;
    } else {
      actionResult = await Match.create({
        user: req.user._id,
        targetUser: profileUserId,
        action
      });
    }

    if (action === 'like') {
      const mutualMatch = await Match.findOne({
        user: profileUserId, 
        targetUser: req.user._id,
        action: 'like'
      });

      if (mutualMatch) {
        actionResult.isMatch = true;
        actionResult.matchedAt = new Date();
        await actionResult.save();

        mutualMatch.isMatch = true;
        mutualMatch.matchedAt = new Date();
        await mutualMatch.save();

        const alreadyLiked = targetProfile.likedBy.some(
          (like: ProfileLikeInfo) => like.profile && like.profile.toString() === currentUserProfile!._id.toString()
        );

        if (!alreadyLiked) {
          targetProfile.likedBy.push({
            profile: currentUserProfile!._id,
            likedAt: new Date()
          });
          await targetProfile.save();
        }

        let quotaInfo;
        try {
          const result = await axios.post('http://localhost:3000/api/subscription/consume-like', {}, {
            headers: {
              'Authorization': req.headers.authorization || ''
            }
          });
          console.log(`[MUTUAL MATCH] Quota endpoint consumed a like, remaining: ${result.data.quotaInfo.remaining}`);
          quotaInfo = result.data.quotaInfo;
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
        const alreadyLiked = targetProfile.likedBy.some(
          (like: ProfileLikeInfo) => like.profile && like.profile.toString() === currentUserProfile!._id.toString()
        );

        if (!alreadyLiked) {
          targetProfile.likedBy.push({
            profile: currentUserProfile!._id,
            likedAt: new Date()
          });
          await targetProfile.save();
        }
      }
    } else if (action === 'pass') {
      const alreadyRejected = currentUserProfile!.rejected?.some(
        (rejection: IProfileReject) => rejection.profile && rejection.profile.toString() === targetProfile._id.toString()
      );

      if (!alreadyRejected && currentUserProfile!.rejected) {
        currentUserProfile!.rejected.push({
          profile: targetProfile._id,
          rejectedAt: new Date()
        });
        await currentUserProfile!.save();
      }
    }

    if (action === 'like') {
      try {
        const result = await axios.post('http://localhost:3000/api/subscription/consume-like', {}, {
          headers: {
            'Authorization': req.headers.authorization || ''
          }
        });
        console.log(`[REGULAR LIKE] Quota endpoint consumed a like, remaining: ${result.data.quotaInfo.remaining}`);
        return res.json({
          success: true,
          match: actionResult,
          message: `Action ${action} registered successfully`,
          quotaInfo: result.data.quotaInfo
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
    }).select('_id name');
    
    const profiles = await Profile.find({
      user: { $in: targetUserIds }
    }).select('user photos lastActive');
    
    const profileMap = new Map<string, IProfile>();
    profiles.forEach((profile: IProfile) => {
      if (profile.user) {
        profileMap.set(profile.user.toString(), profile);
      }
    });
    
    const userMap = new Map<string, Pick<IUser, '_id' | 'name'>>();
    targetUsers.forEach((user: Pick<IUser, '_id' | 'name'>) => { // Explicitly type user here
      userMap.set(user._id.toString(), user);
    });
    
    const matchesWithProfiles = matches.map((match: IMatch) => {
      const targetUserIdString = match.targetUser.toString();
      const profileData: IProfile | undefined = profileMap.get(targetUserIdString);
      const userData: Pick<IUser, '_id' | 'name'> | undefined = userMap.get(targetUserIdString);
      
      const mainPhoto = profileData?.photos?.find((p: IPhoto) => p.isMain);
      
      return {
        _id: match._id,
        targetUser: {
          _id: match.targetUser,
          name: userData?.name || 'Unknown User',
          photo: mainPhoto ? mainPhoto.url : null,
          lastActive: profileData?.lastActive
        },
        matchedAt: match.matchedAt,
        createdAt: match.createdAt
      };
    });

    res.json({
      success: true,
      matches: matchesWithProfiles
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
    let userProfile: IProfile | null = null; 
    
    try {
      const profile = await Profile.findOne({ user: currentUserId });
      if (profile) {
        userProfile = profile;
      } else {
        console.log(`[DEBUG] Profile not found for user ${currentUserId} in /likes, creating one.`);
        userProfile = await Profile.findOneAndUpdate(
          { user: currentUserId },
          { 
            $setOnInsert: {
              user: currentUserId,
              location: { type: 'Point', coordinates: [0,0] as [number, number], city: 'Unknown', country: 'Unknown' },
              interests: [],
              likedBy: [] as ProfileLikeInfo[],
              rejected: [] as IProfileReject[],
              lastActive: new Date(),
              createdAt: new Date()
            }
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        if (!userProfile) {
          throw new Error('Failed to create profile for current user in /likes endpoint');
        }
      }
    } catch (profileError: unknown) {
      console.error('Error fetching or creating profile in /likes:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Error accessing user profile information.',
        error: profileError instanceof Error ? profileError.message : 'Unknown profile error'
      });
    }

    if (!userProfile) {
        return res.status(500).json({
            success: false,
            message: 'User profile could not be determined.'
        });
    }
    const finalUserProfile: IProfile = userProfile;

    // Define PopulatedUser interface here, before its use
    interface PopulatedUser {
      _id: mongoose.Types.ObjectId;
      name: string;
      dateOfBirth: string;
      gender: string;
    }

    // Define the type for a profile document where the 'user' field is populated
    type PopulatedProfile = Omit<IProfile, 'user'> & { user?: PopulatedUser };

    const profilesWhoLikedCurrentUser = await Profile.find({
      'likedBy.profile': finalUserProfile._id
    }).populate('user', 'name dateOfBirth gender'); // Populate user field

    if (!profilesWhoLikedCurrentUser || profilesWhoLikedCurrentUser.length === 0) {
      return res.json({
        success: true,
        likes: [],
        message: 'No one has liked your profile yet'
      });
    }
    
    interface IProfileLikeResponse {
      _id: mongoose.Types.ObjectId;
      user: PopulatedUser;
      photos: IPhoto[];
      bio?: string;
      location?: { city?: string; country?: string };
      interests?: string[];
      occupation?: string;
      education?: string;
      likedAt: Date;
    }

    const formattedLikes: IProfileLikeResponse[] = (profilesWhoLikedCurrentUser as unknown as (PopulatedProfile & mongoose.Document)[]) // More forceful assertion
      .filter((profile): profile is PopulatedProfile & mongoose.Document & { user: PopulatedUser } => !!profile.user)
      .map((profile) => {
        const likeEntry = finalUserProfile.likedBy.find(
          (like: ProfileLikeInfo) => like.profile && like.profile.toString() === profile._id.toString()
        );

        return {
          _id: profile._id,
          user: profile.user, // profile.user is now correctly typed as PopulatedUser
          photos: profile.photos,
          bio: profile.bio,
          location: profile.location ? { city: profile.location.city, country: profile.location.country } : undefined,
          interests: profile.interests,
          occupation: profile.occupation,
          education: profile.education,
          likedAt: likeEntry ? likeEntry.likedAt : new Date()
        };
      });

    res.json({
      success: true,
      likes: formattedLikes
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
