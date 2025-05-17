import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPrice {
  monthly?: number;
  yearly?: number;
}

export interface ISubscriptionPlan extends Document {
  planId: string; // e.g., 'free', 'plus', 'premium' (unique identifier)
  name: string; // e.g., 'Free', 'Plus', 'Premium'
  dailyLikeQuota: number;
  description: string;
  features: string[];
  price?: IPrice;
  isActive: boolean; // To allow deactivating plans without deleting
  order: number; // For display order in UI
  createdAt: Date;
  updatedAt: Date;
}

const PriceSchema: Schema = new Schema({
  monthly: { type: Number, required: false },
  yearly: { type: Number, required: false },
}, { _id: false });

const SubscriptionPlanSchema: Schema = new Schema({
  planId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true, // Store IDs like FREE, PLUS, PREMIUM
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  dailyLikeQuota: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  features: [{
    type: String,
    trim: true,
  }],
  price: {
    type: PriceSchema,
    required: false,
  },
  isActive: { // Admins can toggle plans on/off
    type: Boolean,
    default: true,
  },
  order: { // For controlling display order
    type: Number,
    default: 0,
  }
}, { timestamps: true });

// Ensure planId is indexed for quick lookups
SubscriptionPlanSchema.index({ planId: 1 });
SubscriptionPlanSchema.index({ isActive: 1, order: 1 }); // For fetching active plans in order

const SubscriptionPlan: Model<ISubscriptionPlan> = mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);

export default SubscriptionPlan;