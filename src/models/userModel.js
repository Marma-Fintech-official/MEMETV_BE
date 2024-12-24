const mongoose = require('mongoose')

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },
    telegramId: {
      type: String,
      required: true
    },
    refId: {
      type: String
    },
    totalRewards: {
      type: Number,
      default: 500
    },
    levelUpRewards: {
      type: Number,
      default: 500
    },
    referRewards: {
      type: Number,
      default: 0
    },
    referredById: {
      type: String,
      default: ''
    },
    boosters: [
      {
        type: {
          type: String, // Booster type, e.g., '2x', '3x'
        },
        count: {
          type: Number, // Number of times this booster is available
          default: '',
        },
      },
    ],
    level: {
      type: Number,
      default: 1
    },
    lastLogin: { type: Date }, // Track the last login time
    refferalIds: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Users',
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
  },
  {
    timestamps: true
  }
)

const User = mongoose.model('User', userSchema)

module.exports = User
