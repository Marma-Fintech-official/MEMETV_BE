const mongoose = require('mongoose')
const Schema = mongoose.Schema

const voteSchema = new Schema({
  teams: [
    {
      teamName: {
        type: String
      },
      teamId: {
        type: String
      },
      teamVotes: {
        type: String,
        default: ''
      },
      rank: {
        type: String,
        default: ''
      },
      votersIds: [
        {
          telegramId: {
            type: String
          },
          yourVotes: {
            type: String
          },
          createdAt: {
            type: Date,
            default: Date.now
          }
        }
      ]
    }
  ],
  winner: {
    type: String,
    default: ''
  },
  lose: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  }
})

const Vote = mongoose.model('Vote', voteSchema)

module.exports = Vote
