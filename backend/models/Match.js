const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Match', MatchSchema);
