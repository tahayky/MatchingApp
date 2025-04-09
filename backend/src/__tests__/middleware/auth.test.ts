import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { protect } from '../../middleware/auth';
import User, { IUser } from '../../models/User';

// Extend the Request type to include user
interface AuthRequest extends Request {
  user?: IUser;
}

// Mock modules
jest.mock('jsonwebtoken');
jest.mock('../../models/User');

describe('Auth Middleware', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    // Ensure headers is always defined to avoid TypeScript errors
    req = {
      headers: {
        authorization: undefined
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if no token is provided', async () => {
    // Call the middleware
    await protect(req as AuthRequest, res as Response, next);

    // Assertions
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not authorized, no token'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token format', async () => {
    // Set an invalid token
    if (req.headers) {
      req.headers.authorization = 'InvalidFormat Token123';
    }

    // Call the middleware
    await protect(req as AuthRequest, res as Response, next);

    // Assertions
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not authorized, token failed'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for token verification failure', async () => {
    // Set a token
    if (req.headers) {
      req.headers.authorization = 'Bearer ValidTokenFormat';
    }

    // Mock jwt.verify to throw an error
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    // Call the middleware
    await protect(req as AuthRequest, res as Response, next);

    // Assertions
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not authorized, token failed'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if user not found', async () => {
    // Set a token
    if (req.headers) {
      req.headers.authorization = 'Bearer ValidTokenFormat';
    }

    // Mock successful token verification
    (jwt.verify as jest.Mock).mockReturnValue({ id: 'user123' });

    // Mock User.findById to return null (user not found)
    (User.findById as jest.Mock).mockResolvedValue(null);

    // Call the middleware
    await protect(req as AuthRequest, res as Response, next);

    // Assertions
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not authorized, user not found'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user and call next() for valid token and user', async () => {
    // Set a token
    if (req.headers) {
      req.headers.authorization = 'Bearer ValidTokenFormat';
    }

    // Mock successful token verification
    const userId = new mongoose.Types.ObjectId();
    (jwt.verify as jest.Mock).mockReturnValue({ id: userId });

    // Mock user found
    const mockUser = {
      _id: userId,
      name: 'Test User',
      email: 'test@example.com',
    } as IUser;
    (User.findById as jest.Mock).mockResolvedValue(mockUser);

    // Call the middleware
    await protect(req as AuthRequest, res as Response, next);

    // Assertions
    expect(req.user).toBe(mockUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
