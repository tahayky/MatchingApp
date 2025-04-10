import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/User';

// Extend Express Request interface to include user property
interface AdminRequest extends Request {
  user?: IUser;
}

// Middleware to check if user is an admin
export const isAdmin = (req: AdminRequest, res: Response, next: NextFunction): Response | void => {
  // Check if user exists and has admin privileges
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin privileges required'
    });
  }

  // User is an admin, proceed
  next();
};
