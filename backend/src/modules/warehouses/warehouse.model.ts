import { Schema, model, Document } from 'mongoose';

export interface IWarehouse extends Document {
  code: string;
  name: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Warehouse = model<IWarehouse>('Warehouse', WarehouseSchema);
export default Warehouse;
