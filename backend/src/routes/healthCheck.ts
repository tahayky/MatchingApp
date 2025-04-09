import express, { Request, Response, Router } from 'express';
const router: Router = express.Router();

// @route   GET /api/health
// @desc    Health check endpoint to verify API connectivity
// @access  Public
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

export default router;
