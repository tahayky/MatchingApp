# Dating App Backend API

RESTful API for a mobile dating application with swipe functionality, matching, and profile management.

## Requirements

- Node.js (v14.x or later)
- MongoDB (local or Atlas)
- Postman (for testing)

## Setup

1. **Install dependencies**:

```bash
cd backend
npm install
```

2. **Configure environment variables**:

The backend uses environment variables stored in a `.env` file in the root directory. The file should contain:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000 (optional, defaults to 5000 if not specified)
```

The JWT_SECRET and MONGODB_URI are already set in your .env file.

3. **Start the server**:

```bash
npm start
```

For development with auto-restart on file changes:

```bash
npm run dev
```

## API Testing

The API can be tested using the included Postman collection.

### Using Postman

1. **Import the collection**:
   - Open Postman
   - Click "Import" button
   - Select the file: `DatingApp-API.postman_collection.json`

2. **Create an environment**:
   - Click the gear icon in the top right
   - Click "Add" to create a new environment
   - Name it "Dating App API"
   - Add a variable called "token" (leave it empty for now)
   - Click "Save"

3. **Test the API endpoints**:
   - Start with registering a user through the "Register" endpoint
   - The collection includes auto-extraction of the JWT token from login/register responses
   - After successful login/register, the token will be automatically saved to your environment
   - This token will be used for authenticated requests

### API Workflow

To test the full dating app API functionality:

1. **Authentication**:
   - Register a couple of different users
   - Test login with these users
   - Verify you can get the current user profile

2. **Profile Management**:
   - Create profiles for your users
   - Upload profile photos
   - Set main profile photos
   - Update profile information

3. **Discovery and Matching**:
   - Test the discover endpoint to get profile recommendations
   - Use the matching endpoints to "like" or "pass" on profiles
   - Create matches between users by having them "like" each other
   - View your matches
   - Test unmatching functionality

## API Endpoints

The API is organized into several main sections:

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get a JWT token
- `GET /api/auth/me` - Get the current user's details

### Profiles
- `POST /api/profiles` - Create or update user profile
- `GET /api/profiles/me` - Get current user's profile
- `POST /api/profiles/photos` - Upload a profile photo
- `PUT /api/profiles/photos/:photoId/main` - Set a photo as main
- `GET /api/profiles/discover` - Get profiles for discovery feed

### Users
- `PUT /api/users/me` - Update user information
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/password` - Update user password
- `DELETE /api/users/me` - Delete user account

### Matches
- `POST /api/matches/action` - Create like or pass action
- `GET /api/matches` - Get all matches
- `DELETE /api/matches/:matchId` - Unmatch with a user

## Security

- API uses JWT for authentication
- Protected routes require a valid token
- Passwords are hashed using bcrypt

## File Structure

- `/models` - Database models (MongoDB schemas)
- `/routes` - API routes
- `/middleware` - Custom middleware (auth, etc.)
- `/uploads` - File upload destination (photos)
