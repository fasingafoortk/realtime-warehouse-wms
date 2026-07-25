import { Schema, model, Document, Types } from 'mongoose';

export interface IInboundItem {
  skuId: Types.ObjectId;
  quantityExpected: number;
  quantityReceived: number;
  destinationBinId?: Types.ObjectId;
}

export interface IInboundReceiving extends Document {
  supplierName: string;
  referenceNumber: string;
  status: 'PENDING' | 'RECEIVED' | 'PUTAWAY';
  items: IInboundItem[];
  receivedBy?: Types.ObjectId;
  receivedAt?: Date;
  putawayBy?: Types.ObjectId;
  putawayAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InboundItemSchema = new Schema<IInboundItem>({
  skuId: {
    type: Schema.Types.ObjectId,
    ref: 'SKU',
    required: true,
  },
  quantityExpected: {
    type: Number,
    required: true,
    min: 1,
  },
  quantityReceived: {
    type: Number,
    default: 0,
    min: 0,
  },
  destinationBinId: {
    type: Schema.Types.ObjectId,
    ref: 'Bin',
    default: null,
  },
});

const InboundReceivingSchema = new Schema<IInboundReceiving>(
  {
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RECEIVED', 'PUTAWAY'],
      required: true,
      default: 'PENDING',
    },
    items: {
      type: [InboundItemSchema],
      required: true,
      validate: [
        (val: IInboundItem[]) => val.length > 0,
        'Inbound receiving must contain at least one item.',
      ],
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    putawayBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    putawayAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const InboundReceiving = model<IInboundReceiving>(
  'InboundReceiving',
  InboundReceivingSchema
);
export default InboundReceiving;
