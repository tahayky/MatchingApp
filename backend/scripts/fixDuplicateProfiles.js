const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
}).then(async () => {
  console.log('MongoDB Connected for Profile Fix');
  
  try {
    // Find all users
    const users = await User.find({}).select('_id');
    console.log(`Total users: ${users.length}`);
    
    // Count duplicates and fix them
    let duplicatesFixed = 0;
    
    for (const user of users) {
      // Find all profiles for this user
      const profiles = await Profile.find({ user: user._id });
      
      if (profiles.length > 1) {
        console.log(`User ${user._id} has ${profiles.length} profiles. Fixing...`);
        
        // Sort profiles by creation date (newest first)
        profiles.sort((a, b) => b.createdAt - a.createdAt);
        
        // Keep the most recent profile
        const mainProfile = profiles[0];
        
        // Ensure it has the correct GeoJSON format
        if (!mainProfile.location.type) {
          mainProfile.location.type = 'Point';
          await mainProfile.save();
          console.log(`  Fixed GeoJSON format for profile ${mainProfile._id}`);
        }
        
        // Delete all other profiles
        for (let i = 1; i < profiles.length; i++) {
          await Profile.findByIdAndDelete(profiles[i]._id);
          console.log(`  Deleted duplicate profile ${profiles[i]._id}`);
        }
        
        duplicatesFixed++;
      } else if (profiles.length === 1) {
        // Ensure single profile has the correct GeoJSON format
        const profile = profiles[0];
        
        if (!profile.location.type) {
          profile.location.type = 'Point';
          await profile.save();
          console.log(`Fixed GeoJSON format for profile ${profile._id}`);
        }
      } else {
        console.log(`User ${user._id} has no profile.`);
      }
    }
    
    console.log(`Fixed ${duplicatesFixed} users with duplicate profiles.`);
    console.log('Profile fix completed successfully.');
    
  } catch (error) {
    console.error('Error fixing profiles:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
}).catch(err => {
  console.error('MongoDB Connection Error:', err);
});
