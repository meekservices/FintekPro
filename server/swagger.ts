/**
 * OpenAPI/Swagger Documentation Configuration
 * 
 * Provides interactive API documentation for FintekPro platform
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { logger } from './logger';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FintekPro API',
      version: '1.0.0',
      description: `
# FintekPro Financial Services Platform API

## Overview
FintekPro is a comprehensive financial services platform providing access to investment products, 
KYC verification, portfolio management, market data, and financial tools.

## Authentication
Most endpoints require authentication. Use session-based authentication with cookies.

## Rate Limiting
- General API: 100 requests / 15 minutes
- Authentication endpoints: 5 requests / 15 minutes
- Admin endpoints: Unlimited (for admin users)

## Error Responses
All errors follow a consistent format:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "details": "Additional context (optional)"
}
\`\`\`

## Environments
- **Development**: http://localhost:5000
- **Production**: https://fintekpro.com
- **Admin Portal**: https://admin.fintekpro.com
- **Partner Portal**: https://partner.fintekpro.com
      `.trim(),
      contact: {
        name: 'FintekPro Support',
        email: 'support@fintekpro.com',
        url: 'https://fintekpro.com/support'
      },
      license: {
        name: 'Proprietary',
        url: 'https://fintekpro.com/terms'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://fintekpro.com',
        description: 'Production server'
      },
      {
        url: 'https://admin.fintekpro.com',
        description: 'Admin portal'
      },
      {
        url: 'https://partner.fintekpro.com',
        description: 'Partner portal'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie authentication'
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF token for state-changing requests'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            },
            details: {
              type: 'string',
              example: 'Additional error context'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation successful'
            },
            data: {
              type: 'object',
              example: {}
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '1'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            phone: {
              type: 'string',
              example: '+919876543210'
            },
            role: {
              type: 'string',
              enum: ['client', 'partner', 'admin'],
              example: 'client'
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'prod_12345'
            },
            name: {
              type: 'string',
              example: 'HDFC Equity Fund'
            },
            category: {
              type: 'string',
              enum: ['mutual_funds', 'stocks', 'bonds', 'ipos', 'loans', 'insurance'],
              example: 'mutual_funds'
            },
            subcategory: {
              type: 'string',
              example: 'Equity Funds'
            },
            riskLevel: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'very_high'],
              example: 'medium'
            },
            returns: {
              type: 'object',
              properties: {
                '1y': { type: 'number', example: 12.5 },
                '3y': { type: 'number', example: 15.2 },
                '5y': { type: 'number', example: 18.7 }
              }
            },
            price: {
              type: 'number',
              example: 156.75
            },
            currency: {
              type: 'string',
              example: 'INR'
            }
          }
        },
        Portfolio: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'portfolio_123'
            },
            userId: {
              type: 'string',
              example: '1'
            },
            name: {
              type: 'string',
              example: 'My Investment Portfolio'
            },
            totalValue: {
              type: 'number',
              example: 500000
            },
            totalInvested: {
              type: 'number',
              example: 450000
            },
            gainLoss: {
              type: 'number',
              example: 50000
            },
            gainLossPercent: {
              type: 'number',
              example: 11.11
            }
          }
        },
        KYCStatus: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              example: '1'
            },
            tier: {
              type: 'string',
              enum: ['basic', 'enhanced', 'accredited_investor'],
              example: 'enhanced'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed', 'rejected'],
              example: 'completed'
            },
            verifiedDocuments: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['pan', 'aadhaar', 'bank_account']
            }
          }
        }
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Authentication required'
              }
            }
          }
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Admin access required'
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Resource not found'
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Internal server error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management'
      },
      {
        name: 'Health',
        description: 'System health checks and monitoring'
      },
      {
        name: 'Products',
        description: 'Financial products marketplace'
      },
      {
        name: 'Portfolio',
        description: 'Portfolio management and tracking'
      },
      {
        name: 'KYC',
        description: 'Know Your Customer verification'
      },
      {
        name: 'Market Data',
        description: 'Real-time market quotes and data'
      },
      {
        name: 'Bonds',
        description: 'Bond trading and information'
      },
      {
        name: 'Mutual Funds',
        description: 'Mutual fund investments'
      },
      {
        name: 'Loans',
        description: 'Loan products and applications'
      },
      {
        name: 'Insurance',
        description: 'Insurance products'
      },
      {
        name: 'Calculators',
        description: 'Financial calculators'
      },
      {
        name: 'Admin',
        description: 'Administrative operations'
      }
    ]
  },
  // Look for @swagger comments in these files
  apis: [
    './server/routes.ts',
    './server/health-check.ts',
    './server/swagger-docs/*.ts'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger UI middleware with production protection
 */
export function setupSwagger(app: Express): void {
  // Production protection: Disable Swagger in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_API_DOCS !== 'true') {
    logger.warn('API documentation disabled in production (set ENABLE_API_DOCS=true to enable)');
    app.get('/api/docs', (req, res) => {
      res.status(403).json({ error: 'API documentation is disabled in production' });
    });
    return;
  }

  // Optional: IP whitelist for production
  const allowedIPs = process.env.API_DOCS_ALLOWED_IPS?.split(',') || [];
  const docsMiddleware = (req: any, res: any, next: any) => {
    // Skip IP check in development
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    // Check IP whitelist if configured
    if (allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!allowedIPs.includes(clientIP)) {
        logger.warn('Unauthorized API docs access attempt', { ip: clientIP });
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    next();
  };

  // Serve Swagger JSON
  app.get('/api/docs/swagger.json', docsMiddleware, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve Swagger UI
  app.use('/api/docs', docsMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin-top: 20px }
      .swagger-ui .scheme-container { display: none }
    `,
    customSiteTitle: 'FintekPro API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
      docExpansion: 'list',
      tryItOutEnabled: true
    }
  }));

  logger.info('Swagger documentation available at /api/docs');
}

export { swaggerSpec };
