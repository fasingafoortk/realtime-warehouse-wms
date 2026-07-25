import { ClientSession, Types } from 'mongoose';
import { Order, IOrder } from './order.model';
import { InventoryService } from '../inventory/inventory.service';
import { BadRequestError, NotFoundError } from '../../errors/custom-errors';
import { runInTransaction } from '../../utils/transaction';
import { logger } from '../../utils/logger';

export class OutboundService {
  constructor(private inventoryService: InventoryService) {}

  public async createOrder(data: {
    customerName: string;
    orderNumber: string;
    items: Array<{ skuId: string; quantityRequested: number }>;
  }): Promise<IOrder> {
    const items = data.items.map((item) => ({
      skuId: new Types.ObjectId(item.skuId),
      quantityRequested: item.quantityRequested,
      quantityReserved: 0,
      quantityPicked: 0,
      allocations: [],
    }));

    const order = new Order({
      customerName: data.customerName,
      orderNumber: data.orderNumber,
      status: 'PENDING',
      items,
    });

    return await order.save();
  }

  public async getOrderById(id: string): Promise<IOrder> {
    const order = await Order.findById(id).populate('items.skuId').populate('assignedPickerId');
    if (!order) {
      throw new NotFoundError(`Order with ID '${id}' not found.`);
    }
    return order;
  }

  public async listOrders(filters: { status?: string; page?: number; limit?: number }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.status) query.status = filters.status;

    const total = await Order.countDocuments(query);
    const data = await Order.find(query)
      .populate('items.skuId')
      .populate('assignedPickerId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Transition: PENDING -> RESERVED
   * Allocates inventory bins using FIFO algorithm and locks the stock.
   */
  public async reserveOrder(
    orderId: string,
    warehouseId: string,
    session: ClientSession | null = null
  ): Promise<IOrder> {
    // If no transaction session is passed, wrap it inside our transaction manager
    if (!session) {
      return await runInTransaction(async (tSession) => {
        return await this.reserveOrder(orderId, warehouseId, tSession);
      });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found.`);
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestError(`Cannot reserve stock. Order is in status '${order.status}' (expected 'PENDING').`);
    }

    try {
      for (const item of order.items) {
        // Allocate stock using FIFO algorithm
        const allocations = await this.inventoryService.allocateStock(
          item.skuId.toString(),
          warehouseId,
          item.quantityRequested,
          session
        );

        item.allocations = allocations.map((alloc) => ({
          binId: new Types.ObjectId(alloc.binId),
          quantity: alloc.quantity,
        }));
        item.quantityReserved = item.quantityRequested;
      }

      order.status = 'RESERVED';
      order.reservedAt = new Date();

      logger.info(`Order ${order.orderNumber} reserved successfully.`);
      return await order.save({ session });
    } catch (error) {
      logger.error(`Failed to reserve stock for Order ${order.orderNumber}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Transition: RESERVED -> PICKED
   * Picker assigns themselves and confirms items have been physically picked from storage bins.
   */
  public async pickOrder(
    orderId: string,
    pickerId: string
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new NotFoundError(`Order '${orderId}' not found.`);
    }

    if (order.status !== 'RESERVED') {
      throw new BadRequestError(`Cannot pick order. Order status must be 'RESERVED', current: '${order.status}'.`);
    }

    for (const item of order.items) {
      item.quantityPicked = item.quantityReserved;
    }

    order.status = 'PICKED';
    order.assignedPickerId = new Types.ObjectId(pickerId);
    order.pickedAt = new Date();

    logger.info(`Order ${order.orderNumber} marked as PICKED by user ${pickerId}.`);
    return await order.save();
  }

  /**
   * Transition: PICKED -> SHIPPED
   * Dispatches picked goods. Decrments physical quantities and updates bin metrics.
   */
  public async shipOrder(
    orderId: string,
    warehouseId: string,
    performedBy: string,
    clientMeta: { ipAddress: string; userAgent: string }
  ): Promise<IOrder> {
    return await runInTransaction(async (session: ClientSession | null) => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new NotFoundError(`Order '${orderId}' not found.`);
      }

      if (order.status !== 'PICKED') {
        throw new BadRequestError(`Cannot ship order. Order status must be 'PICKED', current: '${order.status}'.`);
      }

      for (const item of order.items) {
        // Map allocations to allocation result interface
        const allocations = item.allocations.map((a) => ({
          binId: a.binId.toString(),
          quantity: a.quantity,
        }));

        // Deduct inventory and record stock movements
        await this.inventoryService.shipStock(
          item.skuId.toString(),
          warehouseId,
          allocations,
          order._id.toString(),
          performedBy,
          clientMeta,
          session
        );
      }

      order.status = 'SHIPPED';
      order.shippedAt = new Date();

      logger.info(`Order ${order.orderNumber} successfully SHIPPED.`);
      return await order.save({ session });
    });
  }

  /**
   * Transition: PENDING / RESERVED -> CANCELLED
   * Cancels order and releases allocations if reserved.
   */
  public async cancelOrder(
    orderId: string,
    warehouseId: string
  ): Promise<IOrder> {
    return await runInTransaction(async (session: ClientSession | null) => {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new NotFoundError(`Order '${orderId}' not found.`);
      }

      if (['SHIPPED', 'CANCELLED'].includes(order.status)) {
        throw new BadRequestError(`Cannot cancel order. Already in status '${order.status}'.`);
      }

      if (order.status === 'RESERVED') {
        // Release allocations back to stock available pool
        for (const item of order.items) {
          const allocations = item.allocations.map((a) => ({
            binId: a.binId.toString(),
            quantity: a.quantity,
          }));

          await this.inventoryService.releaseStock(
            item.skuId.toString(),
            warehouseId,
            allocations,
            session
          );

          item.allocations = [];
          item.quantityReserved = 0;
        }
      }

      order.status = 'CANCELLED';
      logger.info(`Order ${order.orderNumber} cancelled successfully.`);
      return await order.save({ session });
    });
  }
}
export default OutboundService;
