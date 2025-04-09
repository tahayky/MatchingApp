import express, { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import Match, { IMatch, MatchAction } from '../models/Match';
import Profile, { IProfile, IPhoto } from '../models/Profile';
import User, { IUser } from '../models/User';
import { protect } from '../middleware/auth';

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
  console.log('Received action request:', req.body);
  
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    const { targetUserId, action } = req.body;

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
      // This is a test profile ID, we don't create a real match
      // But we can return a successful response (to keep frontend flow)
      return res.json({
        success: true,
        match: {
          targetUser: targetUserId,
          action,
          isMatch: false // No real match with test IDs
        }
      });
    }

    // IMPORTANT CHANGE: Frontend sends Profile ID, not User ID
    console.log(`[DEBUG] Searching for profile with ID: ${targetUserId}`);
    
    // First search in Profile model (ID from frontend is a profile ID)
    const targetProfile = await Profile.findById(targetUserId);
    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'Target profile not found'
      });
    }
    
    // Profile found, now find the user associated with this profile
    const profileUserId = targetProfile.user;
    console.log(`[DEBUG] Found profile, associated user ID: ${profileUserId}`);
    
    // Check if the associated user exists
    const targetUser = await User.findById(profileUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user associated with the profile not found'
      });
    }

    // Get current user's profile or create if it doesn't exist
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
                coordinates: [0, 0],
                city: 'Unknown',
                country: 'Unknown'
              },
              likedBy: [] as Array<{profile: mongoose.Types.ObjectId; likedAt: Date}>,
              rejected: [] as Array<{profile: mongoose.Types.ObjectId; rejectedAt: Date}>,
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
      } catch (profileError) {
        console.error('Error creating profile in action endpoint:', profileError);
        return res.status(500).json({
          success: false, 
          message: 'Error creating user profile'
        });
      }
    }

    // Check for existing match - use the profileUserId (user ID) not the profile ID
    let existingMatch = await Match.findOne({
      user: req.user._id,
      targetUser: profileUserId
    });
    
    let actionResult;

    // If this action already exists, update it
    if (existingMatch) {
      // If the action hasn't changed, just return the existing match
      if (existingMatch.action === action) {
        return res.json({
          success: true,
          match: existingMatch,
          message: `Action ${action} was already registered`
        });
      }

      // Update the action
      existingMatch.action = action as MatchAction;
      
      // If changed from like to pass, remove the match status if it exists
      if (action === 'pass' && existingMatch.isMatch) {
        existingMatch.isMatch = false;
        existingMatch.matchedAt = undefined;
      }
      
      await existingMatch.save();
      actionResult = existingMatch;
    } else {
      // Create a new match document - use the profileUserId (User ID) not the Profile ID
      actionResult = await Match.create({
        user: req.user._id,
        targetUser: profileUserId,
        action
      });
    }

    // For likes, check if there's a mutual match
    if (action === 'like') {
      // Check if the target user has also liked the current user
      const mutualMatch = await Match.findOne({
        user: profileUserId, // Use the User ID here, not the Profile ID
        targetUser: req.user._id,
        action: 'like'
      });

      if (mutualMatch) {
        // It's a match! Update both match documents
        actionResult.isMatch = true;
        actionResult.matchedAt = new Date();
        await actionResult.save();

        mutualMatch.isMatch = true;
        mutualMatch.matchedAt = new Date();
        await mutualMatch.save();

        // Add an entry to the likedBy array if it doesn't exist already
        const alreadyLiked = targetProfile.likedBy.some(
          like => like.profile && like.profile.toString() === currentUserProfile._id.toString()
        );

        if (!alreadyLiked) {
          targetProfile.likedBy.push({
            profile: currentUserProfile._id,
            likedAt: new Date()
          });
          await targetProfile.save();
        }

        // Return the successful match
        return res.json({
          success: true,
          match: actionResult,
          isNewMatch: true,
          message: "It's a match!"
        });
      } else {
        // This is just a one-way like for now
        // Add an entry to the likedBy array if it doesn't exist already
        const alreadyLiked = targetProfile.likedBy.some(
          like => like.profile && like.profile.toString() === currentUserProfile._id.toString()
        );

        if (!alreadyLiked) {
          targetProfile.likedBy.push({
            profile: currentUserProfile._id,
            likedAt: new Date()
          });
          await targetProfile.save();
        }
      }
    } else if (action === 'pass') {
      // Handle pass action (rejection)
      // Check if already rejected
      const alreadyRejected = currentUserProfile.rejected?.some(
        rejection => rejection.profile && rejection.profile.toString() === targetProfile._id.toString()
      );

      if (!alreadyRejected && currentUserProfile.rejected) {
        // Add to rejected list to filter them out of future discovery
        currentUserProfile.rejected.push({
          profile: targetProfile._id,
          rejectedAt: new Date()
        });
        await currentUserProfile.save();
      }
    }

    res.json({
      success: true,
      match: actionResult,
      message: `Action ${action} registered successfully`
    });
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

    // Find all matches where the current user is involved and match is confirmed
    const matches = await Match.find({
      user: req.user._id,
      isMatch: true
    }).sort({ matchedAt: -1 }); // Sort by most recent matches first

    if (matches.length === 0) {
      return res.json({
        success: true,
        matches: [],
        message: 'No matches found'
      });
    }

    // Extract the target user IDs from matches
    const targetUserIds = matches.map(match => match.targetUser);
    
    // Get user details for all target users
    const targetUsers = await User.find({ 
      _id: { $in: targetUserIds } 
    }).select('_id name');
    
    // Get profiles for these users to get their photos and last active status
    const profiles = await Profile.find({
      user: { $in: targetUserIds }
    }).select('user photos lastActive');
    
    // Create a map of user ID to profile data for quick lookup
    const profileMap = new Map();
    profiles.forEach(profile => {
      if (profile.user) {
        profileMap.set(profile.user.toString(), profile);
      }
    });
    
    // Create a map of user ID to user data for quick lookup
    const userMap = new Map();
    targetUsers.forEach(user => {
      userMap.set(user._id.toString(), user);
    });
    
    // Format matches with enhanced data
    const matchesWithProfiles = matches.map(match => {
      const targetUserId = match.targetUser.toString();
      const profile = profileMap.get(targetUserId);
      const user = userMap.get(targetUserId);
      
      // Find the main photo if available
      const mainPhoto = profile?.photos?.find((p: IPhoto) => p.isMain);
      
      return {
        _id: match._id,
        targetUser: {
          _id: match.targetUser,
          name: user?.name || 'Unknown User',
          photo: mainPhoto ? mainPhoto.url : null,
          lastActive: profile?.lastActive
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

    // Try to get or create the user profile
    let userProfile: IProfile;
    
    try {
      // First try to find the existing profile
      const profile = await Profile.findOne({ user: currentUserId });
      
      if (profile) {
        userProfile = profile;
      } else {
        // If profile doesn't exist, create a new one
        console.log(`[DEBUG] Current user (${currentUserId}) does not have a profile, creating in likes endpoint`);
        
        const newProfile = await Profile.findOneAndUpdate(
          { user: currentUserId },
          { 
            $setOnInsert: {
              user: currentUserId,
              location: {
                type: 'Point',
                coordinates: [0, 0],
                city: 'Unknown',
                country: 'Unknown'
              },
              likedBy: [] as Array<{profile: mongoose.Types.ObjectId; likedAt: Date}>,
              rejected: [] as Array<{profile: mongoose.Types.ObjectId; rejectedAt: Date}>,
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
        
        if (!newProfile) {
          throw new Error('Failed to create user profile');
        }
        
        console.log(`[DEBUG] Created profile for user ${currentUserId} in likes endpoint: ${newProfile._id}`);
        userProfile = newProfile;
      }
    } catch (error) {
      console.error('Error getting or creating profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Error creating user profile',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // At this point userProfile is definitely an IProfile object and not null
    
    // Check if likedBy array exists and has entries
    if (!userProfile.likedBy || userProfile.likedBy.length === 0) {
      return res.json({
        success: true,
        likes: []
      });
    }
    
    // Type for profile likes
    interface IProfileLike {
      profile: mongoose.Types.ObjectId;
      likedAt: Date;
    }
    
    // Get profile IDs of users who liked current user
    const likerProfileIds = userProfile.likedBy.map((like: IProfileLike) => like.profile);

    // Get profiles with their user data
    const likerProfiles = await Profile.find({
      _id: { $in: likerProfileIds }
    }).populate({
      path: 'user',
      select: 'name dateOfBirth'
    });

    // Find already matched profiles to filter them out
    const existingMatches = await Match.find({
      user: currentUserId,
      action: 'like',
      isMatch: true
    }).select('targetUser');
    
    const matchedUserIds = existingMatches.map(match => match.targetUser.toString());

    // Define a type for the populated user (when Profile is populated with User data)
    interface PopulatedUser {
      _id: mongoose.Types.ObjectId;
      name: string;
      dateOfBirth: Date;
    }
    
    // Format the response with proper type assertions
    const formattedLikes = likerProfiles
      .filter(profile => {
        // Ensure user exists and is populated
        if (!profile.user) return false;
        
        // Cast the user field to the correct type
        const user = profile.user as unknown as PopulatedUser;
        
        // Check if this user is already matched
        return !matchedUserIds.includes(user._id.toString());
      })
      .map(profile => {
        // Find when this profile liked the user
        const likeInfo = userProfile.likedBy.find(
          (like: IProfileLike) => like.profile && like.profile.toString() === profile._id.toString()
        );
        
        // Get the main photo
        const mainPhoto = profile.photos?.find(p => p.isMain);
        
        // Cast the user field to access name and dateOfBirth
        const user = profile.user as unknown as PopulatedUser;
        
        // Calculate age
        const birthDate = new Date(user.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        return {
          userId: user._id,
          profileId: profile._id,
          name: user.name,
          age: age,
          bio: profile.bio || '',
          likedAt: likeInfo?.likedAt || new Date(),
          photo: mainPhoto?.url || null
        };
      })
      .sort((a, b) => new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime());

    res.json({
      success: true,
      likes: formattedLikes
    });

  } catch (error: unknown) {
    console.error('Get likes error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({
      success: false,
      message: 'Server error while fetching likes',
      error: errorMessage
    });
  }
});

// @route   GET /api/matches/test
// @desc    Test endpoint for TypeScript matches
// @access  Public
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'TypeScript matches route is working',
    timestamp: new Date().toISOString()
  });
});

export default router;
