import { Schema, model, Document, Types } from 'mongoose';

export interface IAllocation {
  binId: Types.ObjectId;
  quantity: number;
}

export interface IOrderItem {
  skuId: Types.ObjectId;
  quantityRequested: number;
  quantityReserved: number;
  quantityPicked: number;
  allocations: IAllocation[];
}

export interface IOrder extends Document {
  orderNumber: string;
  customerName: string;
  status: 'PENDING' | 'RESERVED' | 'PICKED' | 'SHIPPED' | 'CANCELLED';
  items: IOrderItem[];
  assignedPickerId?: Types.ObjectId;
  reservedAt?: Date;
  pickedAt?: Date;
  shippedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationSchema = new Schema<IAllocation>({
  binId: {
    type: Schema.Types.ObjectId,
    ref: 'Bin',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});

const OrderItemSchema = new Schema<IOrderItem>({
  skuId: {
    type: Schema.Types.ObjectId,
    ref: 'SKU',
    required: true,
  },
  quantityRequested: {
    type: Number,
    required: true,
    min: 1,
  },
  quantityReserved: {
    type: Number,
    default: 0,
    min: 0,
  },
  quantityPicked: {
    type: Number,
    default: 0,
    min: 0,
  },
  allocations: {
    type: [AllocationSchema],
    default: [],
  },
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESERVED', 'PICKED', 'SHIPPED', 'CANCELLED'],
      required: true,
      default: 'PENDING',
      index: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [
        (val: IOrderItem[]) => val.length > 0,
        'Order must contain at least one item.',
      ],
    },
    assignedPickerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reservedAt: {
      type: Date,
      default: null,
    },
    pickedAt: {
      type: Date,
      default: null,
    },
    shippedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = model<IOrder>('Order', OrderSchema);
export default Order;
