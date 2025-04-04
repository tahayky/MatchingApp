const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// @route   POST /api/matches/action
// @desc    Create like or pass action
// @access  Private
router.post('/action', protect, async (req, res) => {
  try {
    const { targetUserId, action } = req.body;

    if (!targetUserId || !action) {
      return res.status(400).json({ 
        success: false, 
        message: 'Target user ID and action are required' 
      });
    }

    if (action !== 'like' && action !== 'pass') {
      return res.status(400).json({ 
        success: false, 
        message: 'Action must be either "like" or "pass"' 
      });
    }

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot perform action on yourself' 
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Target user not found' 
      });
    }

    // Look for existing action from this user to target
    let match = await Match.findOne({
      user: req.user._id,
      targetUser: targetUserId
    });

    if (match) {
      // Update existing record
      match.action = action;
      await match.save();
    } else {
      // Create new action
      match = new Match({
        user: req.user._id,
        targetUser: targetUserId,
        action
      });
      await match.save();
    }

    // If this is a "like" action, check if target user has already liked this user
    let isMatch = false;
    if (action === 'like') {
      const reverseMatch = await Match.findOne({
        user: targetUserId,
        targetUser: req.user._id,
        action: 'like'
      });

      if (reverseMatch) {
        // It's a match! Update both records
        isMatch = true;
        const matchTimestamp = new Date();
        
        match.isMatch = true;
        match.matchedAt = matchTimestamp;
        await match.save();
        
        reverseMatch.isMatch = true;
        reverseMatch.matchedAt = matchTimestamp;
        await reverseMatch.save();
      }
    }

    res.json({
      success: true,
      match: {
        targetUser: targetUserId,
        action,
        isMatch
      }
    });
  } catch (error) {
    console.error('Match action error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   GET /api/matches
// @desc    Get all matches (mutual likes)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Find all mutual matches for current user
    const matches = await Match.find({
      user: req.user._id,
      isMatch: true,
      active: true
    }).populate({
      path: 'targetUser',
      select: 'name'
    });

    // For each match, get the profile info as well
    const matchesWithProfiles = await Promise.all(matches.map(async (match) => {
      const profile = await Profile.findOne({ user: match.targetUser._id });
      
      return {
        matchId: match._id,
        userId: match.targetUser._id,
        name: match.targetUser.name,
        matchedAt: match.matchedAt,
        photo: profile?.photos?.find(p => p.isMain)?.url || null,
        lastActive: profile?.lastActive
      };
    }));

    res.json({
      success: true,
      matches: matchesWithProfiles
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// @route   DELETE /api/matches/:matchId
// @desc    Unmatch with a user
// @access  Private
router.delete('/:matchId', protect, async (req, res) => {
  try {
    // Find the match
    const match = await Match.findById(req.params.matchId);
    
    if (!match) {
      return res.status(404).json({ 
        success: false, 
        message: 'Match not found' 
      });
    }

    // Check that this match belongs to current user
    if (match.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to unmatch this connection' 
      });
    }

    // Set match as inactive
    match.active = false;
    await match.save();
    
    // Also set the reverse match as inactive
    await Match.findOneAndUpdate(
      { 
        user: match.targetUser,
        targetUser: req.user._id
      },
      { active: false }
    );

    res.json({
      success: true,
      message: 'Successfully unmatched'
    });
  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;
