const mongoose = require('mongoose')

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
    telegramId: {
      type: String
    },
    userWalletAddress: {
      type: String,
      trim: true,
      default: ''
    },
    refId: {
      type: String
    },
    referredById: {
      type: String,
      default: ''
    },
    totalRewards: {
      type: Number,
      default: 500
    },
    level: {
      type: Number,
      default: 1
    },
    watchRewards: {
      type: Number,
      default: 0
    },
    referRewards: {
      type: Number,
      default: 0
    },
    levelUpRewards: {
      type: Number,
      default: 500
    },
    gameRewards: {
      gamePoints: {
        type: Number,
        default: 0
      },
      createdAt: {
        type: Date,
        default: 0
      }
    },
    spendingRewards: {
      type: Number,
      default: 0
    },
    stakingRewards: {
      type: Number,
      default: 0
    },
    taskRewards: {
      taskPoints: {
        type: Number,
        default: 0
      },
      twitter: {
        type: Boolean,
        default: false
      },
      telegram: {
        type: Boolean,
        default: false
      },
      youtube: {
        type: Boolean,
        default: false
      }
    },
    streakRewards: {
      type: Number,
      default: 0
    },
    boosters: [{ type: String }],
    lastLogin: { type: Date }, // Track the last login time
    dailyRewards: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Users'
        },
        telegramId: {
          type: String
        },
        totalRewards: {
          type: Number
        },
        userStaking: {
          type: Boolean,
          default: false
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    streak: {
      loginStreak: {
        loginStreakCount: {
          type: Number,
          default: 0
        },
        loginStreakDate: {
          type: Date,
          default: Date.now
        },
        loginStreakReward: [
          {
            type: Number,
            default: 0
          }
        ],
        unClaimedLoginStreakReward: {
          type: Number,
          default: 0
        }
      },
      watchStreak: {
        watchStreakCount: {
          type: Number,
          default: 0
        },
        watchStreakDate: {
          type: Date,
          default: Date.now
        },
        watchStreakReward: [
          {
            type: Number,
            default: 0
          }
        ],
        unClaimedWatchStreakReward: {
          type: Number,
          default: 0
        }
      },
      referStreak: {
        referStreakCount: {
          type: Number,
          default: 0
        },
        referStreakDate: {
          type: Date,
          default: Date.now
        },
        referStreakReward: [
          {
            type: Number,
            default: 0
          }
        ],
        unClaimedReferStreakReward: {
          type: Number,
          default: 0
        }
      },
      taskStreak: {
        taskStreakCount: {
          type: Number,
          default: 0
        },
        taskStreakDate: {
          type: Date,
          default: Date.now
        },
        taskStreakReward: [
          {
            type: Number,
            default: 0
          }
        ],
        unClaimedTaskStreakReward: {
          type: Number,
          default: 0
        }
      },
      multiStreak: {
        multiStreakCount: {
          type: Number,
          default: 0
        },
        multiStreakDate: {
          type: Date,
          default: Date.now
        },
        multiStreakReward: [
          {
            type: Number,
            default: 0
          }
        ],
        unClaimedMultiStreakReward: {
          type: Number,
          default: 0
        },
        streakOfStreakRewards: [
          {
            type: Number,
            default: 0
          }
        ],
        unClaimedStreakOfStreakRewards: {
          type: Number,
          default: 0
        },
        streakOfStreakCount: {
          type: Number,
          default: 0
        },
        lastSOSReward: {
          type: Number,
          default: 0
        }
      },
      claimedLoginDays: {
        type: [Boolean],
        default: () => Array(7).fill(false)
      },
      claimedWatchDays: {
        type: [Boolean],
        default: () => Array(7).fill(false)
      },
      claimedReferDays: {
        type: [Boolean],
        default: () => Array(7).fill(false)
      },
      claimedTaskDays: { type: [Boolean], default: () => Array(7).fill(false) },
      claimedMultiDays: {
        type: [Boolean],
        default: () => Array(7).fill(false)
      },
      startDay: {
        type: Number,
        default: 0
      },
      currentDay: {
        type: Number,
        default: 0
      }
    },
    yourReferenceIds: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Users',
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    staking: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Users'
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    tutorialStatus: {
      type: Boolean,
      default: false
    },
    voteDetails: {
      voteStatus: { type: Boolean, default: false },
      voteDate: { type: Date },
      votingTeamId: {
        type: String,
        default: ''
      },
      votesCount: {
        type: Number,
        default: 0
      },
      battleReward: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
)

const User = mongoose.model('User', userSchema)

module.exports = User
