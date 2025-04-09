import app from './app';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

app.listen(PORT, () => {
  console.log(`
  ⚡️ TypeScript-powered Dating App API running on port ${PORT}!
  ⚡️ Server Time: ${new Date().toLocaleString()}
  ⚡️ Node.js Version: ${process.version}
  ⚡️ Environment: ${process.env.NODE_ENV || 'development'}
  `);
});
