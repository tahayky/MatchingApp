import express, { Request, Response, Router } from 'express';
import User, { IUser } from '../models/User';
import Profile from '../models/Profile';
import { protect } from '../middleware/auth';

const router: Router = express.Router();

// Extend Express Request interface
interface AuthRequest extends Request {
  user?: IUser;
}

// Interface for update fields
interface UserUpdateFields {
  name?: string;
  email?: string;
  interestedIn?: string[];
}

// @route   PUT /api/users/me
// @desc    Update user information
// @access  Private
router.put('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const { name, email, interestedIn } = req.body;

    // Build update object
    const updateFields: UserUpdateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (interestedIn) updateFields.interestedIn = interestedIn;

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error: unknown) {
    console.error('Update user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID (with basic profile info)
// @access  Private
router.get('/:id', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Get basic profile info
    const profile = await Profile.findOne({ user: req.params.id })
      .select('bio photos occupation education interests');

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        gender: user.gender,
        profile: profile || null
      }
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

// @route   PUT /api/users/password
// @desc    Update user password
// @access  Private
router.put('/password', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password and new password are required' 
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error: unknown) {
    console.error('Update password error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

// @route   DELETE /api/users/me
// @desc    Delete user account
// @access  Private
router.delete('/me', protect, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    // Delete user's profile
    await Profile.findOneAndDelete({ user: req.user._id });
    
    // Delete user
    await User.findByIdAndDelete(req.user._id);

    res.json({
      success: true,
      message: 'User account deleted successfully'
    });
  } catch (error: unknown) {
    console.error('Delete account error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: errorMessage 
    });
  }
});

export default router;
