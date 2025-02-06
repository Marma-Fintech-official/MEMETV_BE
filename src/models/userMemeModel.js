const mongoose = require('mongoose')

const userMemeSchema =  mongoose.Schema({

      memeId: {
        type: Number
      },
      memeImage: {
        type: String,
      },
      like: {
        type: Number,
        default: 0
      },
      dislike: {
        type: Number,
        default: 0
      }
},{
    timestamps: true
  }
)


const userMeme = mongoose.model('userMeme', userMemeSchema)

module.exports = userMeme