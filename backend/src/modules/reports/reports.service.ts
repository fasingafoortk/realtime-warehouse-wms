import { Types } from 'mongoose';
import { Stock } from '../inventory/stock.model';
import { StockMovement } from '../inventory/stock-movement.model';
import { Order } from '../outbound/order.model';

export class ReportsService {
  /**
   * Calculates dashboard KPIs for a specific warehouse.
   */
  public async getDashboardKPIs(warehouseId?: string): Promise<any> {
    const whFilter: any = {};
    if (warehouseId) {
      whFilter.warehouseId = new Types.ObjectId(warehouseId);
    }

    // 1. Calculate stock counts
    const stockStats = await Stock.aggregate([
      ...(warehouseId ? [{ $match: whFilter }] : []),
      {
        $group: {
          _id: null,
          totalOnHand: { $sum: '$quantityOnHand' },
          totalReserved: { $sum: '$quantityReserved' },
          totalAvailable: { $sum: '$quantityAvailable' },
        },
      },
    ]);

    const stats = stockStats[0] || { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 };

    // 2. Identify Stockouts (SKUs where available stock is 0 in this warehouse)
    // We group stock by SKU and filter where total available is 0
    const stockouts = await Stock.aggregate([
      ...(warehouseId ? [{ $match: whFilter }] : []),
      {
        $group: {
          _id: '$skuId',
          totalAvailable: { $sum: '$quantityAvailable' },
        },
      },
      {
        $match: { totalAvailable: 0 },
      },
      {
        $lookup: {
          from: 'skus',
          localField: '_id',
          foreignField: '_id',
          as: 'sku',
        },
      },
      { $unwind: '$sku' },
      {
        $project: {
          _id: 0,
          skuId: '$_id',
          code: '$sku.code',
          name: '$sku.name',
        },
      },
    ]);

    // 3. Average Fulfillment Time (from Order Created to Shipped)
    // Filter orders shipped in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fulfillmentStats = await Order.aggregate([
      {
        $match: {
          status: 'SHIPPED',
          shippedAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $project: {
          durationMs: { $subtract: ['$shippedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: '$durationMs' },
          totalShipped: { $sum: 1 },
        },
      },
    ]);

    const avgFulfillmentHours = fulfillmentStats[0]
      ? parseFloat((fulfillmentStats[0].avgDurationMs / (1000 * 60 * 60)).toFixed(2))
      : 0;

    // 4. Turnover Rate per SKU in the last 30 days
    // Formula: (Total Units Shipped / Average Stock level during period)
    // Simplified: (Units Shipped in last 30d) / (Current stock level + 1 to avoid division by zero)
    const turnoverStats = await StockMovement.aggregate([
      {
        $match: {
          type: 'OUTBOUND',
          timestamp: { $gte: thirtyDaysAgo },
          ...(warehouseId
            ? {
                sourceBinId: {
                  $in: await this.getBinIdsForWarehouse(warehouseId),
                },
              }
            : {}),
        },
      },
      {
        $group: {
          _id: '$skuId',
          totalUnitsShipped: { $sum: '$quantity' },
        },
      },
      {
        $lookup: {
          from: 'skus',
          localField: '_id',
          foreignField: '_id',
          as: 'sku',
        },
      },
      { $unwind: '$sku' },
    ]);

    const turnovers = [];
    for (const t of turnoverStats) {
      // Find current stock of this SKU in the warehouse
      const currentStock = await Stock.aggregate([
        {
          $match: {
            skuId: t._id,
            ...(warehouseId ? { warehouseId: new Types.ObjectId(warehouseId) } : {}),
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$quantityOnHand' },
          },
        },
      ]);

      const stockQty = currentStock[0] ? currentStock[0].total : 0;
      const rate = t.totalUnitsShipped / (stockQty || 1);

      turnovers.push({
        skuId: t._id,
        code: t.sku.code,
        name: t.sku.name,
        unitsShipped: t.totalUnitsShipped,
        currentStock: stockQty,
        turnoverRate: parseFloat(rate.toFixed(2)),
      });
    }

    return {
      stockMetrics: {
        totalOnHand: stats.totalOnHand,
        totalReserved: stats.totalReserved,
        totalAvailable: stats.totalAvailable,
      },
      stockoutsCount: stockouts.length,
      stockouts,
      fulfillment: {
        avgHours: avgFulfillmentHours,
        totalShipped: fulfillmentStats[0] ? fulfillmentStats[0].totalShipped : 0,
      },
      turnoverRates: turnovers.sort((a, b) => b.turnoverRate - a.turnoverRate).slice(0, 5),
    };
  }

  private async getBinIdsForWarehouse(warehouseId: string): Promise<Types.ObjectId[]> {
    const bins = await mongoose.model('Bin').find({ warehouseId: new Types.ObjectId(warehouseId) });
    return bins.map((b) => b._id);
  }
}
import mongoose from 'mongoose';
export default ReportsService;
