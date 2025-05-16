import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

interface AdminAuthRequest extends Request {
  adminUser?: any; // Define more specific type if payload is known
}

export const isAdminAuthenticated = (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  let token;

  // 1. Check for token in HttpOnly cookie
  if (req.cookies && req.cookies.admin_auth_token) {
    token = req.cookies.admin_auth_token;
  }
  // 2. Fallback: Check for token in Authorization header (Bearer token)
  // This might be used if the admin panel proxies requests or sends token from localStorage
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined for admin auth middleware.');
    return res.status(500).json({ success: false, message: 'Server configuration error for authentication.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Assuming the JWT payload has a 'user' object with 'role: admin' as set during login
    // @ts-ignore
    if (decoded && decoded.user && decoded.user.role === 'admin') {
       // @ts-ignore
      req.adminUser = decoded.user; // Attach admin user info to request object
      next();
    } else {
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid or not admin' });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ success: false, message: 'Not authorized, token failed verification' });
  }
};