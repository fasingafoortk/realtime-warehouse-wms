import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { redisClient } from '../config/redis';
import { logger } from '../utils/logger';

let rateLimiter: RateLimiterRedis | RateLimiterMemory | null = null;

const initRateLimiter = () => {
  const options = {
    points: 100, // 100 requests
    duration: 60, // per 60 seconds
    blockDuration: 30, // Block for 30 seconds if exceeded
  };

  if (redisClient.isOpen) {
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'wms_rate_limiter',
      ...options,
    });
    logger.info('Redis Rate Limiter initialized.');
  } else {
    rateLimiter = new RateLimiterMemory({
      keyPrefix: 'wms_rate_limiter',
      ...options,
    });
    logger.warn('Redis client is not open; falling back to in-memory rate limiting.');
  }
};

export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!rateLimiter) {
    initRateLimiter();
  }

  // Use client IP
  const ip = req.ip || req.socket.remoteAddress || 'anonymous';

  try {
    const rateLimiterRes = await rateLimiter!.consume(ip);
    res.setHeader('X-RateLimit-Limit', rateLimiter!.points);
    res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString());
    next();
  } catch (rejRes: any) {
    logger.warn(`Rate limit exceeded for client IP: ${ip}`);
    
    const retryAfter = Math.ceil((rejRes.msBeforeNext || 1000) / 1000);
    res.setHeader('Retry-After', retryAfter);
    
    res.status(429).json({
      type: 'https://api.wms.com/errors/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
      instance: req.originalUrl,
    });
  }
};
export default rateLimiterMiddleware;
