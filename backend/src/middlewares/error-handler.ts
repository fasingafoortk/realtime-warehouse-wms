import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/custom-errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const instance = req.originalUrl;
  
  if (err instanceof AppError) {
    logger.warn(`API Error [${err.status}] ${req.method} ${instance}: ${err.detail}`);
    res.status(err.status).json({
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance,
      ...(err.invalidParams ? { invalidParams: err.invalidParams } : {}),
    });
    return;
  }

  // Handle Mongoose cast errors or duplicate key errors
  if (err.name === 'ValidationError') {
    // Mongoose schema validation error
    const mongooseErr = err as any;
    const invalidParams = Object.keys(mongooseErr.errors).map((key) => ({
      name: key,
      reason: mongooseErr.errors[key].message,
    }));
    
    logger.warn(`Validation Error [400] ${req.method} ${instance}: ${err.message}`);
    res.status(400).json({
      type: 'https://api.wms.com/errors/validation-failed',
      title: 'Validation Failed',
      status: 400,
      detail: 'Mongoose schema validation failed.',
      instance,
      invalidParams,
    });
    return;
  }

  if ((err as any).code === 11000) {
    // MongoDB duplicate key error
    const duplicateKey = Object.keys((err as any).keyValue).join(', ');
    const detail = `Duplicate key error. A record with this value for '${duplicateKey}' already exists.`;
    logger.warn(`Conflict Error [409] ${req.method} ${instance}: ${detail}`);
    res.status(409).json({
      type: 'https://api.wms.com/errors/conflict',
      title: 'Resource Conflict',
      status: 409,
      detail,
      instance,
    });
    return;
  }

  // Generic unhandled internal server error
  logger.error(`Internal Server Error [500] ${req.method} ${instance}: ${err.message}\nStack: ${err.stack}`);
  res.status(500).json({
    type: 'https://api.wms.com/errors/internal-error',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred on the server.' 
      : err.message,
    instance,
  });
};
