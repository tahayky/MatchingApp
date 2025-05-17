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
    message: 'Dating App API - TypeScript DEV Version',
    mode: 'TypeScript Development Server',
    status: 'Success',
    timestamp: new Date().toISOString() 
  });
});

// Register TypeScript routes ONLY
app.use('/api/health', healthCheckRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users/profile', userProfileRoutes); // Updated route path
app.use('/api/matches', matchesRoutes);

// Connect to MongoDB
const mongoURI: string = process.env.MONGODB_URI || '';
if (!mongoURI) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose
  .connect(mongoURI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start the server
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Setup Swagger documentation
import { setupSwagger } from './swagger';
setupSwagger(app);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ⚡️ TypeScript DEV Server running on port ${PORT}!
  ⚡️ Server Time: ${new Date().toLocaleString()}
  ⚡️ Node.js Version: ${process.version}
  ⚡️ Environment: ${process.env.NODE_ENV || 'development'}
  
  NOTE: This is a partial implementation with limited endpoints
  
  API Documentation available at: http://localhost:${PORT}/api/docs
  `);
});
