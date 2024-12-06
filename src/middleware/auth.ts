import { AuthRequest, UserRole, User } from '../types';
import { GraphQLError, GraphQLErrorOptions } from 'graphql';
import jwt from 'jsonwebtoken';

// Define a more specific error extension type
type AuthErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INTERNAL_SERVER_ERROR';

interface AuthErrorExtensions {
  code: AuthErrorCode;
  requiredRoles?: UserRole[];
}

interface JWTPayload {
  user: {
    id: string;
    role: UserRole;
    email: string;
    name?: string;
  }
}

// Helper function to create GraphQL errors with proper typing
const createAuthError = (message: string, extensions: GraphQLErrorOptions): GraphQLError => {
  return new GraphQLError(message, {
    extensions: extensions as GraphQLErrorOptions['extensions']
  });
};

// Helper to safely access environment variables
const getEnvVar = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw createAuthError(`${key} not configured`, {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
  return value;
};

export const authenticate = async (req: AuthRequest): Promise<User | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw createAuthError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw createAuthError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED'
      }
    });
  }

  try {
    const jwtSecret = getEnvVar('JWT_SECRET');
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    return decoded.user;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw createAuthError('Token expired', {
        extensions: {
          code: 'UNAUTHENTICATED'
        }
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw createAuthError('Invalid token', {
        extensions: {
          code: 'UNAUTHENTICATED'
        }
      });
    }
    if (error instanceof GraphQLError) {
      throw error;
    }
    throw createAuthError('Authentication failed', {
      extensions: {
        code: 'UNAUTHENTICATED'
      }
    });
  }
};

export const checkRole = (requiredRoles: UserRole[]) => {
  return (user: User | null): boolean => {
    if (!user) {
      throw createAuthError('Authentication required', {
        extensions: {
          code: 'UNAUTHENTICATED'
        }
      });
    }

    if (!requiredRoles.includes(user.role)) {
      throw createAuthError('Not authorized', {
        extensions: {
          code: 'FORBIDDEN',
          requiredRoles
        }
      });
    }

    return true;
  };
};

export const canAccessEmployeeData = (
  user: User | null, 
  employeeId: string
): boolean => {
  if (!user) {
    return false;
  }

  if (user.role === 'ADMIN') {
    return true;
  }

  return user.role === 'EMPLOYEE' && user.id === employeeId;
};

export const createToken = (user: Omit<User, 'name'> & { name?: string }): string => {
  const jwtSecret = getEnvVar('JWT_SECRET');
  const expiresIn = process.env['JWT_EXPIRES_IN'] || '1d';

  return jwt.sign(
    { user },
    jwtSecret,
    { expiresIn }
  );
};

export const verifyToken = (token: string): JWTPayload => {
  const jwtSecret = getEnvVar('JWT_SECRET');

  try {
    return jwt.verify(token, jwtSecret) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw createAuthError('Token expired', {
        extensions: {
          code: 'UNAUTHENTICATED'
        }
      });
    }
    throw createAuthError('Invalid token', {
      extensions: {
        code: 'UNAUTHENTICATED'
      }
    });
  }
};

export type { JWTPayload, AuthErrorExtensions };