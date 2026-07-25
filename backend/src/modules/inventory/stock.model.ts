import { Schema, model, Document, Types } from 'mongoose';

export interface IStock extends Document {
  skuId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  zoneId: Types.ObjectId;
  binId: Types.ObjectId;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  createdAt: Date;
  updatedAt: Date;
}

const StockSchema = new Schema<IStock>(
  {
    skuId: {
      type: Schema.Types.ObjectId,
      ref: 'SKU',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Zone',
      required: true,
      index: true,
    },
    binId: {
      type: Schema.Types.ObjectId,
      ref: 'Bin',
      required: true,
      index: true,
    },
    quantityOnHand: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quantityReserved: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    quantityAvailable: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee only one stock document exists per SKU per Bin
StockSchema.index({ skuId: 1, binId: 1 }, { unique: true });

// Compound index to search quickly for SKUs across a Warehouse
StockSchema.index({ warehouseId: 1, skuId: 1 });

export const Stock = model<IStock>('Stock', StockSchema);
export default Stock;
