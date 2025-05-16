import express, { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { isAdminAuthenticated } from '../middleware/adminAuth'; // Import the new middleware

// Load environment variables
dotenv.config();

const router: Router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USERNAME_ENV = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_ENV = process.env.ADMIN_PASSWORD;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
  process.exit(1); // Exit if JWT_SECRET is not set, as it's critical for security
}
if (!ADMIN_USERNAME_ENV || !ADMIN_PASSWORD_ENV) {
  console.error('FATAL ERROR: ADMIN_USERNAME or ADMIN_PASSWORD is not defined in environment variables.');
  // Potentially exit or disable admin login if not configured
  // For now, we'll log an error. The login attempt will fail safely.
}

// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    if (!ADMIN_USERNAME_ENV || !ADMIN_PASSWORD_ENV) {
      // This case should ideally be caught at startup, but as a fallback:
      return res.status(500).json({ success: false, message: 'Admin login is not configured on the server.' });
    }

    if (username === ADMIN_USERNAME_ENV && password === ADMIN_PASSWORD_ENV) {
      // Credentials match. Generate a JWT.
      const payload = {
        user: {
          id: 'admin_user', // Static ID for admin, or could be from a DB if more complex
          role: 'admin',
        },
      };

      jwt.sign(
        payload,
        JWT_SECRET!, // The ! asserts JWT_SECRET is defined due to the check above
        { expiresIn: '7d' }, // Token expires in 7 days
        (err, token) => {
          if (err || !token) { // Added check for !token
            console.error('Error signing JWT or token is undefined:', err);
            return res.status(500).json({ success: false, message: 'Error generating authentication token' });
          }
          
          // Set HttpOnly cookie containing the JWT
          res.cookie('admin_auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'lax', // Or 'strict' depending on your needs
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days in milliseconds
            path: '/', // Cookie available for all paths
          });

          // Also return token in response body for client-side convenience if needed,
          // though primary session management should rely on the HttpOnly cookie.
          res.json({
            success: true,
            message: 'Admin login successful',
            token, // Client can use this for immediate state update if desired
          });
        }
      );
    } else {
      // Credentials do not match
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Admin login API error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ success: false, message });
  }
});

// Example protected admin route
// @route   GET /api/admin/stats
// @desc    Get some admin-specific stats (example)
// @access  Private (Admin)
router.get('/stats', isAdminAuthenticated, async (req: Request, res: Response) => {
  // This route is now protected by isAdminAuthenticated.
  // req.adminUser will contain the payload from the JWT if authentication was successful.
  // Example: const adminId = (req as any).adminUser.id;

  // In a real application, fetch and return actual stats
  res.json({
    success: true,
    message: 'Admin stats endpoint reached successfully.',
    data: {
      totalUsers: 1000, // Placeholder
      activeSubscriptions: 500, // Placeholder
      serverTime: new Date().toISOString(),
      adminInfo: (req as any).adminUser // Send back admin info from token for demo
    }
  });
});

// Simple health check for the admin route itself
// @route GET /api/admin/health
// @desc Checks if admin routes are registered
// @access Public
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Admin route health check OK' });
});

export default router;