import { Schema, model, Document, Types } from 'mongoose';

export interface IBin extends Document {
  zoneId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  code: string;
  isReceivingDock: boolean;
  maxVolume: number;
  maxWeight: number;
  currentVolume: number;
  currentWeight: number;
  createdAt: Date;
  updatedAt: Date;
}

const BinSchema = new Schema<IBin>(
  {
    zoneId: {
      type: Schema.Types.ObjectId,
      ref: 'Zone',
      required: true,
      index: true,
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    isReceivingDock: {
      type: Boolean,
      default: false,
    },
    maxVolume: {
      type: Number,
      required: true,
      min: 0,
      default: 1000, // cubic units
    },
    maxWeight: {
      type: Number,
      required: true,
      min: 0,
      default: 1000, // weight units (e.g. kg)
    },
    currentVolume: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: code must be unique within a zone and warehouse
BinSchema.index({ warehouseId: 1, zoneId: 1, code: 1 }, { unique: true });

export const Bin = model<IBin>('Bin', BinSchema);
export default Bin;
