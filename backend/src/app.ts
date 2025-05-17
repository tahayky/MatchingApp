import express, { Request, Response, Application } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Import TypeScript routes
import healthCheckRoutes from './routes/healthCheck';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import userProfileRoutes from './routes/userProfile-ts'; // Renamed import
import matchesRoutes from './routes/matches-ts';
import subscriptionRoutes from './routes/subscription';
import adminRoutes from './routes/admin'; // Import admin routes

// Import Swagger documentation
import { setupSwagger } from './swagger';

// Load the TypeScript models but don't configure routes for them yet
// This prevents duplicate model registration
import './models/User';
import './models/Match';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Configure middleware
const adminPanelOrigin = process.env.ADMIN_PANEL_ORIGIN_URL || 'http://localhost:3001'; // Fallback if not set
console.log(`CORS: Allowing origin: ${adminPanelOrigin}`);

app.use(cors({
  origin: adminPanelOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Default routes
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Dating App API - TypeScript Version',
    status: 'Success',
    timestamp: new Date().toISOString() 
  });
});

// Register TypeScript routes
app.use('/api/health', healthCheckRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Explicitly register subscription routes
console.log('Registering subscription routes...');
app.use('/api/subscription', subscriptionRoutes);

// Keep TypeScript test endpoints for development and testing
// Routes related to profile are now part of userProfileRoutes
app.use('/api/users/profile', userProfileRoutes); // Updated route path
app.use('/api/matches/test', matchesRoutes);

// TEMPORARY DEBUG ROUTE
app.get('/api/matches/quota/test-debug', (req: Request, res: Response) => {
  console.log('!!!!!! HIT /api/matches/quota/test-debug !!!!!!');
  res.status(200).json({ message: 'Direct debug route for /api/matches/quota/test-debug is working!' });
});

app.use('/api/matches', matchesRoutes);
app.use('/api/admin', adminRoutes); // Register admin routes

// Log available routes for debugging
app._router.stack.forEach(function(r: any) {
  if (r.route && r.route.path) {
    console.log(`Route registered: ${r.route.path}`);
  } else if (r.name === 'router') {
    r.handle.stack.forEach(function(layer: any) {
      if (layer.route) {
        console.log(`Sub-route: ${layer.route.path}`);
      }
    });
  }
});

// Setup Swagger documentation
setupSwagger(app);

export default app;
