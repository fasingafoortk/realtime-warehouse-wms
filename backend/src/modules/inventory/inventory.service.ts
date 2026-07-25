import { ClientSession, Types } from 'mongoose';
import { Stock } from './stock.model';
import { StockMovement } from './stock-movement.model';
import { Bin } from '../warehouses/bin.model';
import { SKU } from '../skus/sku.model';
import { Zone } from '../warehouses/zone.model';
import { InsufficientStockError, NotFoundError, BadRequestError } from '../../errors/custom-errors';
import { emitStockUpdate } from '../../config/socket';
import { logger } from '../../utils/logger';

export interface IAllocationResult {
  binId: string;
  quantity: number;
}

export class InventoryService {
  /**
   * FIFO Stock Allocation for Outbound Order Reservations.
   * Scans bins containing the SKU in the warehouse, sorted by FIFO (oldest stock entry),
   * and reserves the requested quantity.
   */
  public async allocateStock(
    skuId: string,
    warehouseId: string,
    quantityNeeded: number,
    session: ClientSession | null = null
  ): Promise<IAllocationResult[]> {
    const sku = await SKU.findById(skuId).session(session);
    if (!sku) {
      throw new NotFoundError(`SKU with ID '${skuId}' not found.`);
    }

    // Find all stock entries for SKU in the warehouse with available stock
    // Sort by createdAt ASC (FIFO)
    const stockEntries = await Stock.find({
      skuId: new Types.ObjectId(skuId),
      warehouseId: new Types.ObjectId(warehouseId),
      quantityAvailable: { $gt: 0 },
    })
      .sort({ createdAt: 1 })
      .session(session);

    const totalAvailable = stockEntries.reduce((sum, s) => sum + s.quantityAvailable, 0);
    if (totalAvailable < quantityNeeded) {
      throw new InsufficientStockError(sku.code, quantityNeeded, totalAvailable);
    }

    let remainingNeeded = quantityNeeded;
    const allocations: IAllocationResult[] = [];

    for (const stock of stockEntries) {
      if (remainingNeeded <= 0) break;

      const allocateQty = Math.min(stock.quantityAvailable, remainingNeeded);
      
      // Perform atomic reservation update on the stock document
      stock.quantityReserved += allocateQty;
      stock.quantityAvailable -= allocateQty;
      await stock.save({ session });

      allocations.push({
        binId: stock.binId.toString(),
        quantity: allocateQty,
      });

      remainingNeeded -= allocateQty;
    }

    return allocations;
  }

  /**
   * Release reserved stock back to available pool. (e.g. Order Cancelled)
   */
  public async releaseStock(
    skuId: string,
    _warehouseId: string,
    allocations: IAllocationResult[],
    session: ClientSession | null = null
  ): Promise<void> {
    for (const allocation of allocations) {
      const stock = await Stock.findOne({
        skuId: new Types.ObjectId(skuId),
        binId: new Types.ObjectId(allocation.binId),
      }).session(session);

      if (!stock) {
        logger.error(`Stock entry not found during release: SKU ${skuId}, Bin ${allocation.binId}`);
        continue;
      }

      stock.quantityReserved = Math.max(0, stock.quantityReserved - allocation.quantity);
      stock.quantityAvailable += allocation.quantity;
      await stock.save({ session });
    }
  }

  /**
   * Finalize shipment: physically deduct quantities from reserved stock.
   * Updates bin volume/weight, records tamper-evident movements.
   */
  public async shipStock(
    skuId: string,
    warehouseId: string,
    allocations: IAllocationResult[],
    referenceId: string,
    performedBy: string,
    clientMeta: { ipAddress: string; userAgent: string },
    session: ClientSession | null = null
  ): Promise<void> {
    const sku = await SKU.findById(skuId).session(session);
    if (!sku) throw new NotFoundError(`SKU ${skuId} not found.`);

    for (const allocation of allocations) {
      const stock = await Stock.findOne({
        skuId: new Types.ObjectId(skuId),
        binId: new Types.ObjectId(allocation.binId),
      }).session(session);

      if (!stock) {
        throw new BadRequestError(`Stock record for SKU ${sku.code} in Bin ${allocation.binId} not found.`);
      }

      const preQty = stock.quantityOnHand;
      
      // Deduct physical inventory
      stock.quantityOnHand = Math.max(0, stock.quantityOnHand - allocation.quantity);
      stock.quantityReserved = Math.max(0, stock.quantityReserved - allocation.quantity);
      await stock.save({ session });

      const postQty = stock.quantityOnHand;

      // Update Bin capacity (free space)
      const bin = await Bin.findById(allocation.binId).session(session);
      if (bin) {
        bin.currentWeight = Math.max(0, bin.currentWeight - (sku.weightPerUnit * allocation.quantity));
        bin.currentVolume = Math.max(0, bin.currentVolume - (sku.volumePerUnit * allocation.quantity));
        await bin.save({ session });
      }

      // Record Tamper-Evident Stock Movement
      const movement = new StockMovement({
        skuId: new Types.ObjectId(skuId),
        sourceBinId: new Types.ObjectId(allocation.binId),
        destinationBinId: null,
        quantity: allocation.quantity,
        preQuantity: preQty,
        postQuantity: postQty,
        type: 'OUTBOUND',
        referenceType: 'ORDER',
        referenceId: new Types.ObjectId(referenceId),
        performedBy: new Types.ObjectId(performedBy),
        ipAddress: clientMeta.ipAddress,
        userAgent: clientMeta.userAgent,
        notes: `Shipped order allocation. Bin: ${bin ? bin.code : 'unknown'}.`,
      });
      await movement.save({ session });

      // Trigger WebSockets update
      emitStockUpdate(warehouseId, skuId, {
        binId: allocation.binId,
        quantityOnHand: stock.quantityOnHand,
        quantityReserved: stock.quantityReserved,
        quantityAvailable: stock.quantityAvailable,
      });
    }

    // Check Reorder Trigger
    await this.checkReorderAlert(skuId, warehouseId, session);
  }

  /**
   * Receive stock at loading dock.
   */
  public async receiveStock(
    skuId: string,
    warehouseId: string,
    quantity: number,
    referenceId: string,
    performedBy: string,
    clientMeta: { ipAddress: string; userAgent: string },
    session: ClientSession | null = null
  ): Promise<void> {
    const sku = await SKU.findById(skuId).session(session);
    if (!sku) throw new NotFoundError(`SKU ${skuId} not found.`);

    // Find the designated Receiving Dock Bin in this warehouse
    let dockBin = await Bin.findOne({
      warehouseId: new Types.ObjectId(warehouseId),
      isReceivingDock: true,
    }).session(session);

    if (!dockBin) {
      // Auto-create a dock bin if it doesn't exist for convenience
      // Find a default zone or create one
      let defaultZone = await Zone.findOne({ warehouseId: new Types.ObjectId(warehouseId) }).session(session);
      if (!defaultZone) {
        defaultZone = new Zone({
          warehouseId: new Types.ObjectId(warehouseId),
          code: 'RCV-ZONE',
          name: 'Receiving Dock Zone',
        });
        await defaultZone.save({ session });
      }

      dockBin = new Bin({
        warehouseId: new Types.ObjectId(warehouseId),
        zoneId: defaultZone._id,
        code: 'RCV-DOCK-01',
        isReceivingDock: true,
        maxWeight: 99999,
        maxVolume: 99999,
      });
      await dockBin.save({ session });
    }

    // Find or create Stock entry for receiving bin
    let stock = await Stock.findOne({
      skuId: new Types.ObjectId(skuId),
      binId: dockBin._id,
    }).session(session);

    const preQty = stock ? stock.quantityOnHand : 0;

    if (!stock) {
      stock = new Stock({
        skuId: new Types.ObjectId(skuId),
        warehouseId: new Types.ObjectId(warehouseId),
        zoneId: dockBin.zoneId,
        binId: dockBin._id,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityAvailable: quantity,
      });
    } else {
      stock.quantityOnHand += quantity;
      stock.quantityAvailable += quantity;
    }
    await stock.save({ session });

    const postQty = stock.quantityOnHand;

    // Update dock bin capacity
    dockBin.currentWeight += sku.weightPerUnit * quantity;
    dockBin.currentVolume += sku.volumePerUnit * quantity;
    await dockBin.save({ session });

    // Audit Trail
    const movement = new StockMovement({
      skuId: new Types.ObjectId(skuId),
      sourceBinId: null,
      destinationBinId: dockBin._id,
      quantity,
      preQuantity: preQty,
      postQuantity: postQty,
      type: 'INBOUND',
      referenceType: 'INBOUND_RECEIVING',
      referenceId: new Types.ObjectId(referenceId),
      performedBy: new Types.ObjectId(performedBy),
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
      notes: `Received items at loading dock bin: ${dockBin.code}.`,
    });
    await movement.save({ session });

    emitStockUpdate(warehouseId, skuId, {
      binId: dockBin._id.toString(),
      quantityOnHand: stock.quantityOnHand,
      quantityReserved: stock.quantityReserved,
      quantityAvailable: stock.quantityAvailable,
    });
  }

  /**
   * Directed Putaway: Transfers stock from receiving dock to a storage bin.
   */
  public async putawayStock(
    skuId: string,
    warehouseId: string,
    sourceBinId: string,
    destinationBinId: string,
    quantity: number,
    referenceId: string,
    performedBy: string,
    clientMeta: { ipAddress: string; userAgent: string },
    session: ClientSession | null = null
  ): Promise<void> {
    const sku = await SKU.findById(skuId).session(session);
    if (!sku) throw new NotFoundError(`SKU ${skuId} not found.`);

    // 1. Decrement Source Bin Stock
    const sourceStock = await Stock.findOne({
      skuId: new Types.ObjectId(skuId),
      binId: new Types.ObjectId(sourceBinId),
    }).session(session);

    if (!sourceStock || sourceStock.quantityAvailable < quantity) {
      throw new BadRequestError(`Insufficient stock in source bin for putaway.`);
    }

    const srcPreQty = sourceStock.quantityOnHand;
    sourceStock.quantityOnHand -= quantity;
    sourceStock.quantityAvailable -= quantity;
    await sourceStock.save({ session });
    const srcPostQty = sourceStock.quantityOnHand;

    // Update Source Bin capacity
    const sourceBin = await Bin.findById(sourceBinId).session(session);
    if (sourceBin) {
      sourceBin.currentWeight = Math.max(0, sourceBin.currentWeight - (sku.weightPerUnit * quantity));
      sourceBin.currentVolume = Math.max(0, sourceBin.currentVolume - (sku.volumePerUnit * quantity));
      await sourceBin.save({ session });
    }

    // 2. Increment Destination Bin Stock
    const destinationBin = await Bin.findById(destinationBinId).session(session);
    if (!destinationBin) {
      throw new NotFoundError(`Destination bin ${destinationBinId} not found.`);
    }

    // Validate weight and volume capacities on destination bin
    const weightChange = sku.weightPerUnit * quantity;
    const volumeChange = sku.volumePerUnit * quantity;
    if (destinationBin.currentWeight + weightChange > destinationBin.maxWeight) {
      throw new BadRequestError(`Destination Bin ${destinationBin.code} weight capacity exceeded.`);
    }
    if (destinationBin.currentVolume + volumeChange > destinationBin.maxVolume) {
      throw new BadRequestError(`Destination Bin ${destinationBin.code} volume capacity exceeded.`);
    }

    let destStock = await Stock.findOne({
      skuId: new Types.ObjectId(skuId),
      binId: destinationBin._id,
    }).session(session);



    if (!destStock) {
      destStock = new Stock({
        skuId: new Types.ObjectId(skuId),
        warehouseId: new Types.ObjectId(warehouseId),
        zoneId: destinationBin.zoneId,
        binId: destinationBin._id,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityAvailable: quantity,
      });
    } else {
      destStock.quantityOnHand += quantity;
      destStock.quantityAvailable += quantity;
    }
    await destStock.save({ session });


    // Update Destination Bin capacity
    destinationBin.currentWeight += weightChange;
    destinationBin.currentVolume += volumeChange;
    await destinationBin.save({ session });

    // 3. Create TRANSFER Audit Log
    const movement = new StockMovement({
      skuId: new Types.ObjectId(skuId),
      sourceBinId: new Types.ObjectId(sourceBinId),
      destinationBinId: destinationBin._id,
      quantity,
      preQuantity: srcPreQty, // tracks the change in source bin
      postQuantity: srcPostQty,
      type: 'TRANSFER',
      referenceType: 'INBOUND_RECEIVING',
      referenceId: new Types.ObjectId(referenceId),
      performedBy: new Types.ObjectId(performedBy),
      ipAddress: clientMeta.ipAddress,
      userAgent: clientMeta.userAgent,
      notes: `Putaway transfer from ${sourceBin ? sourceBin.code : sourceBinId} to ${destinationBin.code}.`,
    });
    await movement.save({ session });

    // Emit Socket updates for both bins
    emitStockUpdate(warehouseId, skuId, {
      binId: sourceBinId,
      quantityOnHand: sourceStock.quantityOnHand,
      quantityReserved: sourceStock.quantityReserved,
      quantityAvailable: sourceStock.quantityAvailable,
    });
    emitStockUpdate(warehouseId, skuId, {
      binId: destinationBinId,
      quantityOnHand: destStock.quantityOnHand,
      quantityReserved: destStock.quantityReserved,
      quantityAvailable: destStock.quantityAvailable,
    });
  }

  /**
   * Suggest Putaway Bin (Directed Putaway AI).
   * Finds bins in zones compatible with SKU category, with remaining volume/weight capacity.
   */
  public async suggestPutawayBin(
    skuId: string,
    warehouseId: string
  ): Promise<any[]> {
    const sku = await SKU.findById(skuId);
    if (!sku) throw new NotFoundError('SKU not found.');

    // Fetch compatible zones
    const zones = await Zone.find({
      warehouseId: new Types.ObjectId(warehouseId),
      $or: [
        { allowedCategories: { $size: 0 } }, // Empty allowedCategories means all allowed
        { allowedCategories: sku.category },
      ],
    });

    const zoneIds = zones.map((z) => z._id);

    // Fetch bins within compatible zones that aren't receiving docks
    const bins = await Bin.find({
      warehouseId: new Types.ObjectId(warehouseId),
      zoneId: { $in: zoneIds },
      isReceivingDock: false,
    });

    const suggestions = [];

    for (const bin of bins) {
      const remainingWeight = bin.maxWeight - bin.currentWeight;
      const remainingVolume = bin.maxVolume - bin.currentVolume;

      // Filter bins that can hold at least 1 unit
      if (remainingWeight >= sku.weightPerUnit && remainingVolume >= sku.volumePerUnit) {
        // Calculate maximum units this bin can currently hold
        const maxUnitsByWeight = Math.floor(remainingWeight / sku.weightPerUnit);
        const maxUnitsByVolume = Math.floor(remainingVolume / sku.volumePerUnit);
        const maxCapacityCount = Math.min(maxUnitsByWeight, maxUnitsByVolume);

        // Find if this SKU already exists in this bin (preferred for packing efficiency)
        const existingStock = await Stock.findOne({ skuId: sku._id, binId: bin._id });
        const affinityScore = existingStock ? 2 : 0; // Preference for bins with matching items

        // Scoring: Higher remaining space + affinity
        const utilizationRate = (bin.currentVolume / bin.maxVolume) * 100;
        const score = affinityScore + (100 - utilizationRate) / 10;

        suggestions.push({
          binId: bin._id.toString(),
          binCode: bin.code,
          zoneId: bin.zoneId.toString(),
          maxCapacityCount,
          utilizationRate,
          score,
        });
      }
    }

    // Sort by score DESC
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  /**
   * Query inventory levels across warehouses
   */
  public async getInventoryLevels(filters: {
    warehouseId?: string;
    skuId?: string;
    lowStock?: boolean;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.warehouseId) query.warehouseId = new Types.ObjectId(filters.warehouseId);
    if (filters.skuId) query.skuId = new Types.ObjectId(filters.skuId);

    // If filtering by lowStock, we need to compare total warehouse available stock vs SKU reorder point.
    // This is best achieved using Mongo Aggregation pipeline.
    const pipeline: any[] = [];
    
    // Initial Match on stock
    if (Object.keys(query).length > 0) {
      pipeline.push({ $match: query });
    }

    // Group by SKU and Warehouse to sum quantities
    pipeline.push(
      {
        $group: {
          _id: { skuId: '$skuId', warehouseId: '$warehouseId' },
          totalOnHand: { $sum: '$quantityOnHand' },
          totalReserved: { $sum: '$quantityReserved' },
          totalAvailable: { $sum: '$quantityAvailable' },
          bins: {
            $push: {
              binId: '$binId',
              quantityOnHand: '$quantityOnHand',
              quantityReserved: '$quantityReserved',
              quantityAvailable: '$quantityAvailable',
            },
          },
        },
      },
      // Lookup SKU catalog details
      {
        $lookup: {
          from: 'skus',
          localField: '_id.skuId',
          foreignField: '_id',
          as: 'sku',
        },
      },
      { $unwind: '$sku' },
      // Lookup Warehouse details
      {
        $lookup: {
          from: 'warehouses',
          localField: '_id.warehouseId',
          foreignField: '_id',
          as: 'warehouse',
        },
      },
      { $unwind: '$warehouse' }
    );

    // Filter by low stock (totalAvailable < SKU reorderPoint)
    if (filters.lowStock) {
      pipeline.push({
        $match: {
          $expr: { $lt: ['$totalAvailable', '$sku.reorderPoint'] },
        },
      });
    }

    // For pagination, count total documents
    const countPipeline = [...pipeline, { $count: 'count' }];
    const countResult = await Stock.aggregate(countPipeline);
    const totalRecords = countResult.length > 0 ? countResult[0].count : 0;

    // Apply pagination and project output
    pipeline.push(
      { $sort: { 'sku.code': 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          skuId: '$_id.skuId',
          skuCode: '$sku.code',
          skuName: '$sku.name',
          skuCategory: '$sku.category',
          reorderPoint: '$sku.reorderPoint',
          warehouseId: '$_id.warehouseId',
          warehouseCode: '$warehouse.code',
          warehouseName: '$warehouse.name',
          totalOnHand: 1,
          totalReserved: 1,
          totalAvailable: 1,
          bins: 1,
          isLowStock: { $lt: ['$totalAvailable', '$sku.reorderPoint'] },
        },
      }
    );

    const data = await Stock.aggregate(pipeline);
    
    return {
      data,
      pagination: {
        total: totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  }

  /**
   * Verification check for SKU reorder alert.
   */
  private async checkReorderAlert(
    skuId: string,
    warehouseId: string,
    session: ClientSession | null = null
  ): Promise<void> {
    const sku = await SKU.findById(skuId).session(session);
    if (!sku) return;

    // Calculate total available stock of this SKU in the entire warehouse
    const stocks = await Stock.find({
      skuId: new Types.ObjectId(skuId),
      warehouseId: new Types.ObjectId(warehouseId),
    }).session(session);

    const totalAvailable = stocks.reduce((sum, s) => sum + s.quantityAvailable, 0);

    if (totalAvailable < sku.reorderPoint) {
      logger.warn(
        `[ALERT] Low Stock Triggered for SKU '${sku.code}' in Warehouse '${warehouseId}'. Available: ${totalAvailable}, Reorder Point: ${sku.reorderPoint}.`
      );
      // Here you could send email notifications, enqueue automatic reorder jobs, etc.
    }
  }
}
export default InventoryService;
