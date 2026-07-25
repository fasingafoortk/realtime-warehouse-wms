import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

// Middlewares
import { errorHandler } from './middlewares/error-handler';
import { rateLimiterMiddleware } from './middlewares/rate-limiter';

// Routes
import authRoutes from './modules/auth/auth.routes';
import skuRoutes from './modules/skus/sku.routes';
import warehouseRoutes from './modules/warehouses/warehouse.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import inboundRoutes from './modules/inbound/inbound.routes';
import outboundRoutes from './modules/outbound/outbound.routes';
import reportsRoutes from './modules/reports/reports.routes';

// Config
import { redisClient } from './config/redis';

const app: Express = express();

// Security headers and CORS
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  })
);

app.use(express.json());

// Apply global rate limiting
app.use(rateLimiterMiddleware);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/skus', skuRoutes);
app.use('/api/v1/warehouses', warehouseRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/inbound', inboundRoutes);
app.use('/api/v1/outbound', outboundRoutes);
app.use('/api/v1/reports', reportsRoutes);

// Health Check Endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'up' : 'down';
  const redisStatus = redisClient.isOpen ? 'up' : 'down';

  const isHealthy = mongoStatus === 'up' && redisStatus === 'up';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      database: mongoStatus,
      cache: redisStatus,
    },
    uptime: process.uptime(),
  });
});

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../dist-frontend');
  app.use(express.static(frontendPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // If it's an API route that didn't match, pass it to error handler (404)
    if (req.url.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// RFC 7807 Global Error Handler
app.use(errorHandler);

export default app;
