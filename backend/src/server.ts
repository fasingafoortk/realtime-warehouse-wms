import http from 'http';
import dotenv from 'dotenv';

// Load environment variables before importing configs
dotenv.config();

import app from './app';
import { connectDB } from './config/db';
import { connectRedis, redisClient } from './config/redis';
import { initSocket } from './config/socket';
import { logger } from './utils/logger';
import mongoose from 'mongoose';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // Connect to DB and Redis
  await connectDB();
  await connectRedis();

  const server = http.createServer(app);

  // Initialize Socket.io with Redis Adapter
  initSocket(server);

  server.listen(PORT, () => {
    logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Graceful Shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    
    server.close(async () => {
      logger.info('HTTP server closed.');
      
      try {
        // Disconnect from MongoDB
        await mongoose.connection.close();
        logger.info('MongoDB connection closed.');

        // Disconnect from Redis
        if (redisClient.isOpen) {
          await redisClient.quit();
          logger.info('Redis client disconnected.');
        }

        process.exit(0);
      } catch (err: any) {
        logger.error(`Error during graceful shutdown: ${err.message}`);
        process.exit(1);
      }
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forceful shutdown triggered after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error(`Critical error starting server: ${error.message}`);
  process.exit(1);
});
