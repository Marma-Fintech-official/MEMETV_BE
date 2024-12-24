const mongoose = require('mongoose');

const userRewardSchema = mongoose.Schema(
  {
    category: {
      type: String,
    },
    date: {
      type: Date,
    },
    rewardPoints: {
      type: Number,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    telegramId: {
      type: String,
      ref: 'User',
    },
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

const userReward = mongoose.model('userReward', userRewardSchema);

module.exports = userReward;

