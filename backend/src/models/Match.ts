import mongoose, { Schema, Document, Model } from 'mongoose';

// Define action type
export type MatchAction = 'like' | 'pass';

// Define Match interface
export interface IMatch extends Document {
  user: mongoose.Types.ObjectId;
  targetUser: mongoose.Types.ObjectId;
  action: MatchAction;
  isMatch: boolean;
  matchedAt?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema: Schema = new Schema({
  // The user who initiated the action (like/dislike)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The target user who was liked/disliked
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Action type: "like" or "pass"
  action: {
    type: String,
    enum: ['like', 'pass'],
    required: true
  },
  // Has a mutual match been formed
  isMatch: {
    type: Boolean,
    default: false
  },
  // Match timestamp (when both users liked each other)
  matchedAt: {
    type: Date
  },
  // Is the match active or unmatched
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Make sure we don't have duplicate entries for the same user pair and action
MatchSchema.index({ user: 1, targetUser: 1 }, { unique: true });

// Create and export the Match model
const Match: Model<IMatch> = mongoose.model<IMatch>('Match', MatchSchema);
export default Match;
