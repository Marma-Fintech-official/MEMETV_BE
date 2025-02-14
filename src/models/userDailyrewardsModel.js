const mongoose = require('mongoose')

const userDailyrewardSchema =  mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users'
      },
      telegramId: {
        type: String,
        ref: 'Users'
      },
      dailyEarnedRewards: {
        type: Number
      },
      userStaking: {
        type: Boolean,
        default: false
      },
      userOnlineStatus: {
        type: Boolean,
        default: false
      },
      dailyMemeCount: {
        type: Number,
        default: 0
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
},{
    timestamps: true
  }
)


const userDailyreward = mongoose.model('userDailyreward', userDailyrewardSchema)

module.exports = userDailyreward