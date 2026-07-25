import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient } from './redis';
import { logger } from '../utils/logger';

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // If Redis is connected, attach the adapter
  if (redisClient.isOpen) {
    const pubClient = redisClient;
    const subClient = redisClient.duplicate();
    
    subClient.connect()
      .then(() => {
        io!.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter attached successfully.');
      })
      .catch((err) => {
        logger.error(`Failed to attach Socket.io Redis adapter: ${err.message}`);
      });
  } else {
    logger.warn('Redis client is not open; running Socket.io with fallback in-memory adapter.');
  }

  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected to WebSocket: ${socket.id}`);

    // Join room for specific warehouse real-time updates
    socket.on('join:warehouse', (warehouseId: string) => {
      socket.join(`warehouse:${warehouseId}`);
      logger.debug(`Client ${socket.id} joined room warehouse:${warehouseId}`);
    });

    socket.on('leave:warehouse', (warehouseId: string) => {
      socket.leave(`warehouse:${warehouseId}`);
      logger.debug(`Client ${socket.id} left room warehouse:${warehouseId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected from WebSocket: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Please invoke initSocket first.');
  }
  return io;
};

export const emitStockUpdate = (warehouseId: string, skuId: string, payload: any) => {
  if (io) {
    io.to(`warehouse:${warehouseId}`).emit('stock:update', { skuId, ...payload });
    io.emit('stock:global_update', { warehouseId, skuId, ...payload });
  }
};
