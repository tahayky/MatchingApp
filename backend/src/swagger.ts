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
        },
      },
      Profile: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Profile ID',
          },
          user: {
            type: 'string',
            description: 'User ID that profile belongs to',
          },
          bio: {
            type: 'string',
            description: 'User biography',
          },
          location: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['Point'],
                description: 'GeoJSON type',
              },
              coordinates: {
                type: 'array',
                items: {
                  type: 'number',
                },
                description: 'Coordinates [longitude, latitude]',
              },
              city: {
                type: 'string',
                description: 'City name',
              },
              country: {
                type: 'string',
                description: 'Country name',
              },
            },
          },
          photos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Photo URL',
                },
                isMain: {
                  type: 'boolean',
                  description: 'Whether this is the main profile photo',
                },
              },
            },
          },
          interests: {
            type: 'array',
            items: {
              type: 'string',
            },
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
                  min: {
                    type: 'number',
                    description: 'Minimum age preference',
                  },
                  max: {
                    type: 'number',
                    description: 'Maximum age preference',
                  },
                },
              },
              distance: {
                type: 'number',
                description: 'Maximum distance in km',
              },
            },
          },
        },
      },
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
