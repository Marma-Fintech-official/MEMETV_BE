const mongoose = require('mongoose')

const userHistorySchema =  mongoose.Schema({

      memeId: {
        type: Number
      },
      telegramId: {
        type: String,
        ref : 'User'
      },
},{
    timestamps: true
  }
)


const userHistory = mongoose.model('userHistory', userHistorySchema)

module.exports = userHistory