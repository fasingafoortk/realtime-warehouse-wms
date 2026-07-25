import mongoose, { ClientSession, Types } from 'mongoose';
import { InboundReceiving, IInboundReceiving } from './inbound.model';
import { InventoryService } from '../inventory/inventory.service';
import { BadRequestError, NotFoundError } from '../../errors/custom-errors';
import { runInTransaction } from '../../utils/transaction';
import { logger } from '../../utils/logger';

export class InboundService {
  constructor(private inventoryService: InventoryService) {}

  public async createInbound(data: {
    supplierName: string;
    referenceNumber: string;
    items: Array<{ skuId: string; quantityExpected: number }>;
  }): Promise<IInboundReceiving> {
    const items = data.items.map((item) => ({
      skuId: new Types.ObjectId(item.skuId),
      quantityExpected: item.quantityExpected,
      quantityReceived: 0,
    }));

    const inbound = new InboundReceiving({
      supplierName: data.supplierName,
      referenceNumber: data.referenceNumber,
      status: 'PENDING',
      items,
    });

    logger.info(`Inbound receiving record created: ${inbound.referenceNumber}`);
    return await inbound.save();
  }

  public async getInboundById(id: string): Promise<IInboundReceiving> {
    const inbound = await InboundReceiving.findById(id).populate('items.skuId');
    if (!inbound) {
      throw new NotFoundError(`Inbound receiving record '${id}' not found.`);
    }
    return inbound;
  }

  public async listInbounds(filters: { status?: string; page?: number; limit?: number }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filters.status) query.status = filters.status;

    const total = await InboundReceiving.countDocuments(query);
    const data = await InboundReceiving.find(query)
      .populate('items.skuId')
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
   * Transition: PENDING -> RECEIVED
   * Receives items at the warehouse dock.
   */
  public async receiveInbound(
    inboundId: string,
    warehouseId: string,
    itemsReceived: Array<{ skuId: string; quantityReceived: number }>,
    performedBy: string,
    clientMeta: { ipAddress: string; userAgent: string }
  ): Promise<IInboundReceiving> {
    return await runInTransaction(async (session: ClientSession | null) => {
      const inbound = await InboundReceiving.findById(inboundId).session(session);
      if (!inbound) {
        throw new NotFoundError(`Inbound record '${inboundId}' not found.`);
      }

      if (inbound.status !== 'PENDING') {
        throw new BadRequestError(`Cannot receive items. Inbound is not in PENDING state, current: '${inbound.status}'.`);
      }

      // Validate quantities and receive stock
      for (const rx of itemsReceived) {
        const item = inbound.items.find((i) => i.skuId.toString() === rx.skuId);
        if (!item) {
          throw new BadRequestError(`SKU ${rx.skuId} is not in the inbound manifest.`);
        }

        if (rx.quantityReceived <= 0) {
          throw new BadRequestError(`Invalid received quantity for SKU ${rx.skuId}: ${rx.quantityReceived}`);
        }

        item.quantityReceived = rx.quantityReceived;

        // Ingest into receiving dock bin via inventory service
        await this.inventoryService.receiveStock(
          rx.skuId,
          warehouseId,
          rx.quantityReceived,
          inbound._id.toString(),
          performedBy,
          clientMeta,
          session
        );
      }

      inbound.status = 'RECEIVED';
      inbound.receivedBy = new Types.ObjectId(performedBy);
      inbound.receivedAt = new Date();

      logger.info(`Inbound ${inbound.referenceNumber} received at dock.`);
      return await inbound.save({ session });
    });
  }

  /**
   * Transition: RECEIVED -> PUTAWAY
   * Transfers items from receiving dock to designated storage bins.
   */
  public async putawayInbound(
    inboundId: string,
    warehouseId: string,
    putawayInstructions: Array<{ skuId: string; destinationBinId: string }>,
    performedBy: string,
    clientMeta: { ipAddress: string; userAgent: string }
  ): Promise<IInboundReceiving> {
    return await runInTransaction(async (session: ClientSession | null) => {
      const inbound = await InboundReceiving.findById(inboundId).session(session);
      if (!inbound) {
        throw new NotFoundError(`Inbound record '${inboundId}' not found.`);
      }

      if (inbound.status !== 'RECEIVED') {
        throw new BadRequestError(`Cannot put away items. Inbound must be in 'RECEIVED' state, current: '${inbound.status}'.`);
      }

      for (const instruction of putawayInstructions) {
        const item = inbound.items.find((i) => i.skuId.toString() === instruction.skuId);
        if (!item) {
          throw new BadRequestError(`SKU ${instruction.skuId} is not in the inbound manifest.`);
        }

        if (item.quantityReceived <= 0) {
          continue; // Nothing received to putaway
        }

        // Find dock bin dynamically to pass to putawayStock
        const dbBin = await mongoose.model('Bin').findOne({
          warehouseId: new Types.ObjectId(warehouseId),
          isReceivingDock: true,
        }).session(session);

        if (!dbBin) {
          throw new BadRequestError('Receiving dock bin not found for warehouse.');
        }

        item.destinationBinId = new Types.ObjectId(instruction.destinationBinId);

        // Execute putaway transfer from dock bin to target bin
        await this.inventoryService.putawayStock(
          instruction.skuId,
          warehouseId,
          dbBin._id.toString(),
          instruction.destinationBinId,
          item.quantityReceived,
          inbound._id.toString(),
          performedBy,
          clientMeta,
          session
        );
      }

      inbound.status = 'PUTAWAY';
      inbound.putawayBy = new Types.ObjectId(performedBy);
      inbound.putawayAt = new Date();

      logger.info(`Inbound ${inbound.referenceNumber} putaway completed.`);
      return await inbound.save({ session });
    });
  }
}
export default InboundService;
