import express, { Request, Response, Application } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Import TypeScript routes
import healthCheckRoutes from './routes/healthCheck';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import profilesRoutes from './routes/profiles-ts';
import matchesRoutes from './routes/matches-ts';

// Import Swagger documentation
import { setupSwagger } from './swagger';

// Load the TypeScript models but don't configure routes for them yet
// This prevents duplicate model registration
import './models/User';
import './models/Profile';
import './models/Match';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Configure middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Keep TypeScript test endpoints for development and testing 
app.use('/api/profiles/test', profilesRoutes);
app.use('/api/matches/test', matchesRoutes);

// Use JS implementations for now, for complete functionality
// We could gradually convert these to TypeScript when time permits
const profilesJS = require('../routes/profiles');
const matchesJS = require('../routes/matches');

app.use('/api/profiles', profilesJS);
app.use('/api/matches', matchesJS);

// Setup Swagger documentation
setupSwagger(app);

export default app;
