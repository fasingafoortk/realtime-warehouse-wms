import mongoose, { Schema, model, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface IStockMovement extends Document {
  skuId: Types.ObjectId;
  sourceBinId?: Types.ObjectId;
  destinationBinId?: Types.ObjectId;
  quantity: number;
  preQuantity: number;
  postQuantity: number;
  type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';
  referenceType: 'ORDER' | 'INBOUND_RECEIVING' | 'AUDIT_CORRECTION';
  referenceId: Types.ObjectId;
  performedBy: Types.ObjectId;
  ipAddress: string;
  userAgent: string;
  hash: string;
  timestamp: Date;
  notes?: string;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    skuId: {
      type: Schema.Types.ObjectId,
      ref: 'SKU',
      required: true,
      index: true,
    },
    sourceBinId: {
      type: Schema.Types.ObjectId,
      ref: 'Bin',
      default: null,
      index: true,
    },
    destinationBinId: {
      type: Schema.Types.ObjectId,
      ref: 'Bin',
      default: null,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    preQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    postQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT'],
      required: true,
    },
    referenceType: {
      type: String,
      enum: ['ORDER', 'INBOUND_RECEIVING', 'AUDIT_CORRECTION'],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Tamper-Evident SHA-256 Hash Chain Generation pre-save
StockMovementSchema.pre<IStockMovement>('save', async function (next) {
  if (this.isNew) {
    try {
      // Find the absolute latest stock movement record
      const lastMovement = await mongoose
        .model<IStockMovement>('StockMovement')
        .findOne()
        .sort({ createdAt: -1, _id: -1 });

      const previousHash = lastMovement ? lastMovement.hash : 'GENESIS_HASH_SEED';

      const payload = [
        previousHash,
        this.skuId.toString(),
        this.sourceBinId ? this.sourceBinId.toString() : '',
        this.destinationBinId ? this.destinationBinId.toString() : '',
        this.quantity.toString(),
        this.preQuantity.toString(),
        this.postQuantity.toString(),
        this.type,
        this.referenceType,
        this.referenceId.toString(),
        this.performedBy.toString(),
        this.timestamp.getTime().toString(),
      ].join('|');

      this.hash = crypto.createHash('sha256').update(payload).digest('hex');
    } catch (error: any) {
      return next(error);
    }
  }
  next();
});

export const StockMovement = model<IStockMovement>('StockMovement', StockMovementSchema);
export default StockMovement;
