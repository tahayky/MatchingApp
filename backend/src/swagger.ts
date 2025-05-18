import express, { Request, Response } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Dating App API',
    version: '1.0.0',
    description: 'A dating app API with TypeScript',
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    contact: {
      name: 'API Support',
      email: 'support@datingapp.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        required: ['email', 'password', 'name', 'dateOfBirth', 'gender', 'interestedIn'],
        properties: {
          _id: {
            type: 'string',
            description: 'User ID',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email',
          },
          password: {
            type: 'string',
            format: 'password',
            description: 'User password',
          },
          name: {
            type: 'string',
            description: 'User full name',
          },
          dateOfBirth: {
            type: 'string',
            format: 'date',
            description: 'User date of birth',
          },
          gender: {
            type: 'string',
            enum: ['male', 'female', 'other'],
            description: 'User gender',
          },
          interestedIn: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['male', 'female', 'other'],
            },
            description: 'Gender preferences',
          },
          isProfileComplete: {
            type: 'boolean',
            description: 'Whether user has completed their profile',
          },
          // Merged Profile Fields Start
          photos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'Photo URL' },
                isMain: { type: 'boolean', description: 'Is this the main photo?' },
                _id: { type: 'string', description: 'Photo sub-document ID (Mongoose specific)'}
              },
            },
            description: 'User photos',
          },
          bio: {
            type: 'string',
            maxLength: 500,
            description: 'User biography',
          },
          location: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['Point'], default: 'Point', description: 'GeoJSON type' },
              coordinates: { type: 'array', items: { type: 'number' }, default: [0,0], description: '[longitude, latitude]' },
              city: { type: 'string', description: 'City name' },
              country: { type: 'string', description: 'Country name' },
            },
            description: 'User location',
          },
          interests: {
            type: 'array',
            items: { type: 'string' },
            description: 'User interests',
          },
          occupation: {
            type: 'string',
            description: 'User occupation',
          },
          education: {
            type: 'string',
            description: 'User education',
          },
          height: {
            type: 'number',
            description: 'User height in cm',
          },
          preferences: {
            type: 'object',
            properties: {
              ageRange: {
                type: 'object',
                properties: {
                  min: { type: 'number', default: 18 },
                  max: { type: 'number', default: 100 },
                },
              },
              distance: { type: 'number', default: 50, description: 'Preferred distance in km' },
            },
            description: 'User matching preferences',
          },
          likedBy: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                user: { type: 'string', description: 'ID of the user who liked this user' },
                likedAt: { type: 'string', format: 'date-time' },
              }
            },
            description: 'List of users who liked this user',
          },
          rejected: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                user: { type: 'string', description: 'ID of the user rejected by this user' },
                rejectedAt: { type: 'string', format: 'date-time' },
              }
            },
            description: 'List of users this user has rejected',
          },
          lastActive: {
            type: 'string',
            format: 'date-time',
            description: 'Last active timestamp',
          },
          // Merged Profile Fields End
          // Subscription and Quota Fields (already part of User model)
          subscriptionTier: {
            type: 'string',
            default: 'FREE',
            description: 'User subscription tier ID (e.g., FREE, PLUS, PREMIUM)',
          },
          subscriptionExpiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'When the current paid subscription expires',
          },
          dailyLikeQuota: {
            type: 'number',
            description: 'How many likes this user can perform daily based on their tier',
          },
          remainingLikes: {
            type: 'number',
            description: 'How many likes the user has left for the current period',
          },
          likesResetTime: {
            type: 'string',
            format: 'date-time',
            description: 'When the like quota will reset next',
          },
          isAdmin: {
            type: 'boolean',
            default: false,
            description: 'Is the user an administrator',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      // The separate Profile schema is no longer needed as its fields are merged into User.
      // Profile: { ... old definition removed ... }
      Match: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Match ID',
          },
          user: {
            type: 'string',
            description: 'User ID who performed the action',
          },
          targetUser: {
            type: 'string',
            description: 'Target user ID',
          },
          action: {
            type: 'string',
            enum: ['like', 'pass'],
            description: 'Action performed',
          },
          isMatch: {
            type: 'boolean',
            description: 'Whether this is a mutual match',
          },
          matchedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the match occurred',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the action was created',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          error: {
            type: 'string',
            example: 'Detailed error information',
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: [
    './src/routes/*.ts',
    './src/models/*.ts',
  ],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

// Function to setup our docs
export const setupSwagger = (app: express.Application): void => {
  // Route for swagger docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Route to get swagger specs
  app.get('/api/docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('Swagger docs available at /api/docs');
};
