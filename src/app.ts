import express, { Request, Response, NextFunction } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { GraphQLFormattedError } from 'graphql';
import mongoose from 'mongoose';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { authenticate, createToken } from './middleware/auth';
import { createDataLoaders } from './utils/dataloaders';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { json } from 'body-parser';
import { AuthRequest, Context, GraphQLErrorExtensions } from './types';
import http from 'http';
import compression from 'compression';

// Load environment variables
dotenv.config();

console.log('MONGODB_URI:', process.env['MONGODB_URI']);
console.log('JWT_SECRET:', process.env['JWT_SECRET']);

// Environment variable validation
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is missing`);
  }
}

const app = express();
const httpServer = http.createServer(app);

// Custom request logging interface
interface ResponseWithStartTime extends Response {
  requestStartTime?: number;
}

// Middleware
app.use(cors({
  origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(helmet({
  contentSecurityPolicy: process.env['NODE_ENV'] === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());
app.use(json({ limit: '1mb' }));

// Request logging middleware
app.use((req: Request, res: ResponseWithStartTime, next: NextFunction) => {
  res.requestStartTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - (res.requestStartTime || Date.now());
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoints
app.get('/health', (_: Request, res: Response) => res.status(200).json({ status: 'OK' }));
app.get('/health/db', async (_: Request, res: Response) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: 'OK' });
  } catch (error) {
    res.status(503).json({ 
      status: 'ERROR', 
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// token generate endpoint
app.post('/auth/token', async (req: Request, res: Response) => {
  try {
    const { id, role, email, name } = req.body;

    // Validate the request body
    if (!id || !role || !email) {
      return res.status(400).json({ error: 'Missing required fields: id, role, or email' });
    }

    // Create a user object as expected by `createToken`
    const user = { id, role, email, name };

    // Generate the token
    const token = createToken(user);

    // Return the token
    return res.status(200).json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Database connection with retry logic
const connectDB = async (retries = 5): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env['MONGODB_URI']!);
    console.log('Connected to MongoDB');
  } catch (error) {
    if (retries > 0) {
      console.log(`MongoDB connection failed. Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    }
    throw error;
  }
};

// Apollo Server configuration
async function startServer(): Promise<void> {
  const server = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      process.env['NODE_ENV'] === 'production'
        ? ApolloServerPluginLandingPageLocalDefault({ embed: false })
        : ApolloServerPluginLandingPageLocalDefault()
    ],
    formatError: (formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
      // Log the error
      console.error('GraphQL Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        extensions: formattedError.extensions
      });
      
      // In production, sanitize error messages
      if (process.env['NODE_ENV'] === 'production') {
        if (
          formattedError.extensions?.['code'] === 'UNAUTHENTICATED' ||
          formattedError.extensions?.['code'] === 'FORBIDDEN' ||
          formattedError.extensions?.['code'] === 'BAD_USER_INPUT'
        ) {
          return formattedError;
        }
        
        interface CustomGraphQLErrorExtensions extends GraphQLErrorExtensions {
          [key: string]: unknown;
        }

        return {
          message: 'Internal server error',
          extensions: {
            code: 'INTERNAL_SERVER_ERROR'
          } as CustomGraphQLErrorExtensions
        };
      }
      
      return formattedError;
    }
  });

  await server.start();
  
  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<Context> => {
        const user = await authenticate(req as AuthRequest);
        return {
          user,
          loaders: createDataLoaders()
        };
      }
    })
  );

  const PORT = process.env['PORT'] || 4000;

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    try {
      await server.stop();
      await mongoose.connection.close();
      httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`
🚀 Server ready at http://localhost:${PORT}/graphql
🔋 Environment: ${process.env['NODE_ENV'] || 'development'}
      `);
      resolve();
    });
  });
}

// Start the application
(async () => {
  try {
    await connectDB();
    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Global error handlers
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

export default app;