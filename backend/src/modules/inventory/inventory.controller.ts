import { Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';
import { StockMovement } from './stock-movement.model';
import { Stock } from './stock.model';
import { Bin } from '../warehouses/bin.model';
import { SKU } from '../skus/sku.model';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { Types } from 'mongoose';
import { NotFoundError, BadRequestError } from '../../errors/custom-errors';
import { runInTransaction } from '../../utils/transaction';

export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  public getInventory = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const warehouseId = req.query.warehouseId as string;
      const skuId = req.query.skuId as string;
      const lowStock = req.query.lowStock === 'true';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const levels = await this.inventoryService.getInventoryLevels({
        warehouseId,
        skuId,
        lowStock,
        page,
        limit,
      });

      res.status(200).json(levels);
    } catch (error) {
      next(error);
    }
  };

  public getAuditLogs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const skuId = req.query.skuId as string;
      const type = req.query.type as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const query: any = {};
      if (skuId) query.skuId = new Types.ObjectId(skuId);
      if (type) query.type = type;

      const total = await StockMovement.countDocuments(query);
      const data = await StockMovement.find(query)
        .populate('skuId', 'code name')
        .populate('sourceBinId', 'code')
        .populate('destinationBinId', 'code')
        .populate('performedBy', 'name email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

      res.status(200).json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPutawaySuggestions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { warehouseId, skuId } = req.query;
      if (!warehouseId || !skuId) {
        throw new BadRequestError('warehouseId and skuId query parameters are required.');
      }

      const suggestions = await this.inventoryService.suggestPutawayBin(
        skuId as string,
        warehouseId as string
      );

      res.status(200).json(suggestions);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Admin-only stock adjustment (manual override)
   */
  public adjustStock = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { warehouseId, binId, skuId, quantity } = req.body;
      const performedBy = req.user!.id;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const sku = await SKU.findById(skuId);
      if (!sku) throw new NotFoundError('SKU not found.');

      const bin = await Bin.findOne({ _id: new Types.ObjectId(binId), warehouseId: new Types.ObjectId(warehouseId) });
      if (!bin) throw new NotFoundError('Bin not found in warehouse.');

      const result = await runInTransaction(async (session) => {
        let stock = await Stock.findOne({ skuId: new Types.ObjectId(skuId), binId: new Types.ObjectId(binId) }).session(session);
        
        const preQty = stock ? stock.quantityOnHand : 0;
        
        if (!stock) {
          stock = new Stock({
            skuId: new Types.ObjectId(skuId),
            warehouseId: new Types.ObjectId(warehouseId),
            zoneId: bin.zoneId,
            binId: bin._id,
            quantityOnHand: quantity,
            quantityReserved: 0,
            quantityAvailable: quantity,
          });
        } else {
          // Adjust physical quantity
          stock.quantityOnHand = quantity;
          stock.quantityAvailable = Math.max(0, quantity - stock.quantityReserved);
        }
        await stock.save({ session });
        const postQty = stock.quantityOnHand;

        // Recalculate Bin capacity (free up and re-allocate)
        const weightDiff = (postQty - preQty) * sku.weightPerUnit;
        const volumeDiff = (postQty - preQty) * sku.volumePerUnit;

        bin.currentWeight = Math.max(0, bin.currentWeight + weightDiff);
        bin.currentVolume = Math.max(0, bin.currentVolume + volumeDiff);
        await bin.save({ session });

        // Record Audit Trail
        const movement = new StockMovement({
          skuId: new Types.ObjectId(skuId),
          sourceBinId: preQty > postQty ? bin._id : null,
          destinationBinId: postQty > preQty ? bin._id : null,
          quantity: Math.abs(postQty - preQty),
          preQuantity: preQty,
          postQuantity: postQty,
          type: 'ADJUSTMENT',
          referenceType: 'AUDIT_CORRECTION',
          referenceId: new Types.ObjectId(performedBy), // Reference self
          performedBy: new Types.ObjectId(performedBy),
          ipAddress,
          userAgent,
          notes: req.body.notes || 'Manual inventory adjustment.',
        });
        await movement.save({ session });

        return stock;
      });

      res.status(200).json({
        message: 'Stock adjusted successfully.',
        stock: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
export default InventoryController;
