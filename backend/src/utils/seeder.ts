import bcrypt from 'bcryptjs';
import { User } from '../modules/users/user.model';
import { Warehouse } from '../modules/warehouses/warehouse.model';
import { Zone } from '../modules/warehouses/zone.model';
import { Bin } from '../modules/warehouses/bin.model';
import { SKU } from '../modules/skus/sku.model';
import { Stock } from '../modules/inventory/stock.model';
import { InboundReceiving } from '../modules/inbound/inbound.model';
import { Order } from '../modules/outbound/order.model';
import { logger } from './logger';

export const seedDatabase = async (): Promise<void> => {
  try {
    // 1. Seed Users if not present
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      logger.info('Seeding demo user accounts...');
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
      logger.info('Demo user accounts seeded.');
    }

    // 2. Seed Warehouse Catalog and initial transactions if not present
    const whCount = await Warehouse.countDocuments();
    if (whCount === 0) {
      logger.info('No warehouses found. Seeding catalog, stock levels, and transaction records...');

      // Seed Warehouses
      const warehousesData = [
        {
          code: 'WH-NY',
          name: 'New York Logistics Hub',
          address: '100 Hub Road, New York, NY',
        },
        {
          code: 'WH-CA',
          name: 'California Distribution Center',
          address: '500 Gateway Boulevard, Los Angeles, CA',
        },
      ];
      const seededWarehouses = await Warehouse.insertMany(warehousesData);
      const whNY = seededWarehouses[0];
      const whCA = seededWarehouses[1];
      logger.info('Warehouses seeded.');

      // Seed Zones
      const zonesData = [
        {
          warehouseId: whNY._id,
          code: 'ZONE-A',
          name: 'Electronics Fast-Pick Area',
          allowedCategories: ['Electronics'],
        },
        {
          warehouseId: whNY._id,
          code: 'ZONE-B',
          name: 'Bulk Pallet Storage',
          allowedCategories: [], // All categories allowed
        },
        {
          warehouseId: whCA._id,
          code: 'ZONE-C',
          name: 'Furniture High-Rack Zone',
          allowedCategories: ['Furniture'],
        },
      ];
      const seededZones = await Zone.insertMany(zonesData);
      const zoneA = seededZones[0];
      const zoneB = seededZones[1];
      const zoneC = seededZones[2];
      logger.info('Warehouse zones seeded.');

      // Seed Bins
      const binsData = [
        // NY Warehouse Bins
        {
          warehouseId: whNY._id,
          zoneId: zoneA._id,
          code: 'A-01',
          isReceivingDock: false,
          maxWeight: 500,
          maxVolume: 300,
        },
        {
          warehouseId: whNY._id,
          zoneId: zoneA._id,
          code: 'A-02',
          isReceivingDock: false,
          maxWeight: 500,
          maxVolume: 300,
        },
        {
          warehouseId: whNY._id,
          zoneId: zoneB._id,
          code: 'B-01',
          isReceivingDock: false,
          maxWeight: 2000,
          maxVolume: 1500,
        },
        {
          warehouseId: whNY._id,
          zoneId: zoneB._id,
          code: 'RCV-DOCK-01',
          isReceivingDock: true,
          maxWeight: 99999,
          maxVolume: 99999,
        },
        // CA Warehouse Bins
        {
          warehouseId: whCA._id,
          zoneId: zoneC._id,
          code: 'C-01',
          isReceivingDock: false,
          maxWeight: 1500,
          maxVolume: 1000,
        },
        {
          warehouseId: whCA._id,
          zoneId: zoneC._id,
          code: 'RCV-DOCK-02',
          isReceivingDock: true,
          maxWeight: 99999,
          maxVolume: 99999,
        },
      ];
      const seededBins = await Bin.insertMany(binsData);
      const binA1 = seededBins[0];
      const binA2 = seededBins[1];
      const binB1 = seededBins[2];
      const binC1 = seededBins[4];
      logger.info('Storage and Receiving Bins seeded.');

      // Seed SKUs
      const skusData = [
        {
          code: 'SKU-LOGI-M510',
          name: 'Logitech Wireless Mouse M510',
          description: 'Comfortable full-size wireless laser mouse.',
          category: 'Electronics',
          price: 29.99,
          reorderPoint: 30,
          reorderQuantity: 100,
          unitOfMeasure: 'units',
          weightPerUnit: 0.12,
          volumePerUnit: 0.05,
        },
        {
          code: 'SKU-COR-K70',
          name: 'Corsair K70 Mechanical Keyboard',
          description: 'RGB mechanical gaming keyboard with MX Speed switches.',
          category: 'Electronics',
          price: 129.99,
          reorderPoint: 15,
          reorderQuantity: 50,
          unitOfMeasure: 'units',
          weightPerUnit: 1.25,
          volumePerUnit: 0.25,
        },
        {
          code: 'SKU-ASUS-PG27',
          name: 'ASUS ROG Swift 27" Monitor',
          description: '1440p 240Hz IPS gaming monitor.',
          category: 'Electronics',
          price: 499.99,
          reorderPoint: 5,
          reorderQuantity: 15,
          unitOfMeasure: 'units',
          weightPerUnit: 5.5,
          volumePerUnit: 1.8,
        },
        {
          code: 'SKU-STEEL-CHAIR',
          name: 'Steelcase Gesture Office Chair',
          description: 'Ergonomic office desk chair with multi-link armrests.',
          category: 'Furniture',
          price: 999.99,
          reorderPoint: 5,
          reorderQuantity: 10,
          unitOfMeasure: 'units',
          weightPerUnit: 22.0,
          volumePerUnit: 6.2,
        },
      ];
      const seededSKUs = await SKU.insertMany(skusData);
      const skuMouse = seededSKUs[0];
      const skuKeyboard = seededSKUs[1];
      const skuMonitor = seededSKUs[2];
      const skuChair = seededSKUs[3];
      logger.info('SKU Catalog seeded.');

      // Seed Initial Stock Levels
      const stockData = [
        {
          skuId: skuMouse._id,
          warehouseId: whNY._id,
          zoneId: zoneA._id,
          binId: binA1._id,
          quantityOnHand: 80,
          quantityReserved: 0,
          quantityAvailable: 80,
        },
        {
          skuId: skuKeyboard._id,
          warehouseId: whNY._id,
          zoneId: zoneA._id,
          binId: binA2._id,
          quantityOnHand: 25,
          quantityReserved: 0,
          quantityAvailable: 25,
        },
        {
          skuId: skuMonitor._id,
          warehouseId: whNY._id,
          zoneId: zoneB._id,
          binId: binB1._id,
          quantityOnHand: 10,
          quantityReserved: 0,
          quantityAvailable: 10,
        },
        {
          skuId: skuChair._id,
          warehouseId: whCA._id,
          zoneId: zoneC._id,
          binId: binC1._id,
          quantityOnHand: 8,
          quantityReserved: 0,
          quantityAvailable: 8,
        },
      ];
      await Stock.insertMany(stockData);

      // Update bin weights and volumes
      binA1.currentWeight = 80 * skuMouse.weightPerUnit;
      binA1.currentVolume = 80 * skuMouse.volumePerUnit;
      await binA1.save();

      binA2.currentWeight = 25 * skuKeyboard.weightPerUnit;
      binA2.currentVolume = 25 * skuKeyboard.volumePerUnit;
      await binA2.save();

      binB1.currentWeight = 10 * skuMonitor.weightPerUnit;
      binB1.currentVolume = 10 * skuMonitor.volumePerUnit;
      await binB1.save();

      binC1.currentWeight = 8 * skuChair.weightPerUnit;
      binC1.currentVolume = 8 * skuChair.volumePerUnit;
      await binC1.save();

      logger.info('Initial stock levels and bin occupancy metrics loaded.');

      // Seed Pending Supplier Inbound Manifest
      const inboundManifest = new InboundReceiving({
        supplierName: 'Logitech Wholesale Corp',
        referenceNumber: 'IB-LOGI-8802',
        status: 'PENDING',
        items: [
          {
            skuId: skuMouse._id,
            quantityExpected: 150,
            quantityReceived: 0,
          },
          {
            skuId: skuKeyboard._id,
            quantityExpected: 40,
            quantityReceived: 0,
          },
        ],
      });
      await inboundManifest.save();
      logger.info('Pending Supplier Inbound Manifest preloaded.');

      // Seed Pending Customer Outbound Order
      const outboundOrder = new Order({
        orderNumber: 'ORD-AMZN-9912',
        customerName: 'Amazon Fulfillment Depot',
        status: 'PENDING',
        items: [
          {
            skuId: skuMouse._id,
            quantityRequested: 15,
            quantityReserved: 0,
            quantityPicked: 0,
            allocations: [],
          },
          {
            skuId: skuKeyboard._id,
            quantityRequested: 10,
            quantityReserved: 0,
            quantityPicked: 0,
            allocations: [],
          },
        ],
      });
      await outboundOrder.save();
      logger.info('Pending Customer Outbound Order preloaded.');

      logger.info('Warehouse Catalog, stocks and transaction records seeded successfully!');
    } else {
      logger.info('Warehouse catalog already exists. Skipping catalog auto-seeding.');
    }
  } catch (error: any) {
    logger.error(`Error during database seeding: ${error.message}`);
  }
};
