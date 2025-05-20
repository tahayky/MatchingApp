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
  console.log(`[USER AUTH PROTECT] Request: ${req.method} ${req.originalUrl}`);
  let token;

  // Check if token exists in header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Get token from header (Bearer token)
    token = req.headers.authorization.split(' ')[1];
    console.log(`[USER AUTH PROTECT] Token found in Authorization header.`);
  } else {
    console.log(`[USER AUTH PROTECT] No Authorization header with Bearer token found.`);
  }

  // Check if token exists
  if (!token) {
    console.log(`[USER AUTH PROTECT] Responding 401: Not authorized, no token provided.`);
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }

  try {
    console.log(`[USER AUTH PROTECT] Attempting to verify token: ${token.substring(0,15)}...`);
    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    console.log(`[USER AUTH PROTECT] Token decoded successfully. User ID from token: ${decoded.id}`);

    // Find user by id
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log(`[USER AUTH PROTECT] User not found for ID: ${decoded.id}. Responding 401.`);
      return res.status(401).json({
        success: false,
        message: 'User not found for token' // More specific message
      });
    }
    
    req.user = user as IUser;
    console.log(`[USER AUTH PROTECT] User ${req.user.email} authenticated successfully. Calling next().`);
    next();
  } catch (error) {
    console.error('[USER AUTH PROTECT] Token verification error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token verification failed'
    });
  }
};
