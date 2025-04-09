import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from '../models/User';

// Extend Express Request interface to include user property
interface AuthRequest extends Request {
  user?: IUser;
}

// Interface for JWT payload
interface JwtPayload {
  id: string;
  iat?: number;
  exp?: number;
}

// Middleware to authenticate token
export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void | Response> => {
  let token;

  // Check if token exists in header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Get token from header (Bearer token)
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, no token provided' 
    });
  }

  try {
    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

    // Find user by id
    const user = await User.findById(decoded.id).select('-password');
    req.user = user as IUser;
    
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, token failed' 
    });
  }
};
