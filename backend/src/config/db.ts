import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/wms?replicaSet=rs0';
    logger.info(`Connecting to MongoDB at: ${connStr.replace(/:([^@:]+)@/, ':****@')}`); // Hide passwords in log
    
    await mongoose.connect(connStr);
    
    logger.info('MongoDB Connected successfully.');
  } catch (error: any) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB connection error: ${err.message}`);
});
