import { Schema, model, Document } from 'mongoose';

export interface ISKU extends Document {
  code: string;
  name: string;
  description: string;
  category: string;
  price: number;
  reorderPoint: number;
  reorderQuantity: number;
  unitOfMeasure: string;
  weightPerUnit: number;
  volumePerUnit: number;
  createdAt: Date;
  updatedAt: Date;
}

const SKUSchema = new Schema<ISKU>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    reorderPoint: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    reorderQuantity: {
      type: Number,
      required: true,
      min: 1,
      default: 50,
    },
    unitOfMeasure: {
      type: String,
      required: true,
      default: 'units',
    },
    weightPerUnit: {
      type: Number,
      required: true,
      min: 0,
      default: 0.1, // kg
    },
    volumePerUnit: {
      type: Number,
      required: true,
      min: 0,
      default: 0.1, // liters/m^3
    },
  },
  {
    timestamps: true,
  }
);

export const SKU = model<ISKU>('SKU', SKUSchema);
export default SKU;
