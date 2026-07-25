import bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.model';
import { logger } from './logger';

export const seedDatabase = async (): Promise<void> => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      logger.info('Database already contains records. Skipping auto-seeding.');
      return;
    }

    logger.info('Empty database detected. Seeding demo accounts...');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    const demoUsers = [
      {
        email: 'admin@wms.com',
        passwordHash,
        name: 'Demo Admin',
        role: 'Admin',
      },
      {
        email: 'manager@wms.com',
        passwordHash,
        name: 'Demo Manager',
        role: 'Warehouse Manager',
      },
      {
        email: 'picker@wms.com',
        passwordHash,
        name: 'Demo Picker',
        role: 'Picker',
      },
      {
        email: 'auditor@wms.com',
        passwordHash,
        name: 'Demo Auditor',
        role: 'Auditor',
      },
    ];

    await User.insertMany(demoUsers);
    logger.info('Demo accounts seeded successfully.');
  } catch (error: any) {
    logger.error(`Error seeding database: ${error.message}`);
  }
};
