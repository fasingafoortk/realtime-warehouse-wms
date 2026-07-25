import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { SKU } from '../../src/modules/skus/sku.model';
import { Stock } from '../../src/modules/inventory/stock.model';
import { Bin } from '../../src/modules/warehouses/bin.model';
import { Zone } from '../../src/modules/warehouses/zone.model';
import { InsufficientStockError, NotFoundError } from '../../src/errors/custom-errors';
import { Types } from 'mongoose';

// Mock mongoose models
jest.mock('../../src/modules/skus/sku.model');
jest.mock('../../src/modules/inventory/stock.model');
jest.mock('../../src/modules/warehouses/bin.model');
jest.mock('../../src/modules/warehouses/zone.model');
jest.mock('../../src/modules/inventory/stock-movement.model');
jest.mock('../../src/config/socket', () => ({
  emitStockUpdate: jest.fn(),
}));

describe('InventoryService - Unit Tests', () => {
  let inventoryService: InventoryService;

  const validSkuId = new Types.ObjectId().toString();
  const validWarehouseId = new Types.ObjectId().toString();
  const validBinId1 = new Types.ObjectId().toString();
  const validBinId2 = new Types.ObjectId().toString();
  const validZoneId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    inventoryService = new InventoryService();
  });

  describe('allocateStock (FIFO Strategy)', () => {
    it('should throw NotFoundError if SKU does not exist', async () => {
      (SKU.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });

      await expect(
        inventoryService.allocateStock(new Types.ObjectId().toString(), new Types.ObjectId().toString(), 5)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientStockError if total stock across bins is less than requested', async () => {
      const skuMock = { _id: validSkuId, code: 'SKU-001' };
      (SKU.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(skuMock),
      });

      const stockMock = [
        { binId: validBinId1, quantityAvailable: 2 },
        { binId: validBinId2, quantityAvailable: 1 },
      ];
      (Stock.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue(stockMock),
        }),
      });

      await expect(
        inventoryService.allocateStock(validSkuId, validWarehouseId, 5)
      ).rejects.toThrow(InsufficientStockError);
    });

    it('should allocate stock from oldest bins first (FIFO sorting) and modify available/reserved totals', async () => {
      const skuMock = { _id: validSkuId, code: 'SKU-001' };
      (SKU.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(skuMock),
      });

      // Bins returned in FIFO sorted order by mock
      const stock1 = { binId: validBinId1, quantityReserved: 0, quantityAvailable: 5, save: jest.fn() };
      const stock2 = { binId: validBinId2, quantityReserved: 0, quantityAvailable: 3, save: jest.fn() };
      
      (Stock.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          session: jest.fn().mockResolvedValue([stock1, stock2]),
        }),
      });

      const allocations = await inventoryService.allocateStock(validSkuId, validWarehouseId, 7);

      // We need 7. Stock1 has 5, Stock2 has 3.
      // Allocates 5 from Stock1 (emptying it), 2 from Stock2.
      expect(allocations).toEqual([
        { binId: validBinId1, quantity: 5 },
        { binId: validBinId2, quantity: 2 },
      ]);

      expect(stock1.quantityReserved).toBe(5);
      expect(stock1.quantityAvailable).toBe(0);
      expect(stock1.save).toHaveBeenCalled();

      expect(stock2.quantityReserved).toBe(2);
      expect(stock2.quantityAvailable).toBe(1);
      expect(stock2.save).toHaveBeenCalled();
    });
  });

  describe('suggestPutawayBin (Directed Putaway)', () => {
    it('should suggest the bin with the highest score based on category match and available capacity', async () => {
      const skuMock = { _id: validSkuId, category: 'COLD', weightPerUnit: 10, volumePerUnit: 5 };
      (SKU.findById as jest.Mock).mockResolvedValue(skuMock);

      // Zones matching SKU category
      const zonesMock = [{ _id: validZoneId, code: 'Z-COLD' }];
      (Zone.find as jest.Mock).mockResolvedValue(zonesMock);

      // Bins in those zones
      const bin1 = {
        _id: validBinId1,
        code: 'B-01',
        zoneId: validZoneId,
        maxWeight: 100,
        currentWeight: 80, // remaining: 20 (can fit 2 units)
        maxVolume: 50,
        currentVolume: 40, // remaining: 10 (can fit 2 units)
      };

      const bin2 = {
        _id: validBinId2,
        code: 'B-02',
        zoneId: validZoneId,
        maxWeight: 100,
        currentWeight: 10, // remaining: 90 (can fit 9 units)
        maxVolume: 50,
        currentVolume: 10, // remaining: 40 (can fit 8 units)
      };
      (Bin.find as jest.Mock).mockResolvedValue([bin1, bin2]);

      // Stock lookup mock
      (Stock.findOne as jest.Mock).mockImplementation(({ binId }) => {
        if (binId.toString() === validBinId1) return Promise.resolve(null);
        return Promise.resolve({ skuId: validSkuId }); // bin2 has matching sku (affinity bonus)
      });

      const suggestions = await inventoryService.suggestPutawayBin(validSkuId, validWarehouseId);

      // bin2 should have higher capacity and affinity score, making it top suggestion
      expect(suggestions.length).toBe(2);
      expect(suggestions[0].binId).toBe(validBinId2);
      expect(suggestions[0].maxCapacityCount).toBe(8); // min of (90/10=9, 40/5=8)
      expect(suggestions[1].binId).toBe(validBinId1);
    });
  });
});
