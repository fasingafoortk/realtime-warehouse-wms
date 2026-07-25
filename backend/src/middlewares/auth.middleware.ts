import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors/custom-errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'Admin' | 'Warehouse Manager' | 'Picker' | 'Auditor';
  };
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access token is missing or malformed.');
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'super-secret-access-token-key-change-in-production';

  try {
    const decoded = jwt.verify(token, secret) as {
      id: string;
      email: string;
      role: 'Admin' | 'Warehouse Manager' | 'Picker' | 'Auditor';
    };
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Access token has expired.');
    }
    throw new UnauthorizedError('Access token is invalid.');
  }
};

export const requireRole = (
  ...allowedRoles: Array<'Admin' | 'Warehouse Manager' | 'Picker' | 'Auditor'>
) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: '${req.user.role}'.`
      );
    }
    next();
  };
};
