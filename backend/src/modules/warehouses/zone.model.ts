import { Schema, model, Document, Types } from 'mongoose';

export interface IZone extends Document {
  warehouseId: Types.ObjectId;
  code: string;
  name: string;
  allowedCategories: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ZoneSchema = new Schema<IZone>(
  {
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    allowedCategories: {
      type: [String],
      default: [], // empty means all categories are allowed
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: code must be unique within a warehouse
ZoneSchema.index({ warehouseId: 1, code: 1 }, { unique: true });

export const Zone = model<IZone>('Zone', ZoneSchema);
export default Zone;
