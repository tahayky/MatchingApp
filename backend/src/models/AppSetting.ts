import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAppSetting extends Document {
  key: string; // e.g., 'discoverRateLimit'
  value: any; // Can store various types of settings
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppSettingSchema: Schema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: Schema.Types.Mixed, // Allows storing complex objects like { windowMs: 10000, max: 5 }
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

AppSettingSchema.index({ key: 1 });

const AppSetting: Model<IAppSetting> = mongoose.model<IAppSetting>('AppSetting', AppSettingSchema);

export default AppSetting;