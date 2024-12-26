const User = require('../models/userModel')
const mongoose = require('mongoose')
const { isValidObjectId } = mongoose
const logger = require('../helpers/logger')

const levelUpBonuses = [
  // 500, Level 1 bonus, you reach 1000 its level2 you got level2 bonus points
  1000, // Level 2 to Level 3
  10000, // Level 3 to Level 4
  50000, // Level 4 to Level 5
  100000, // Level 5 to Level 6
  500000, // Level 6 to Level 7
  1000000, // Level 7 to Level 8
  5000000, // Level 8 to Level 9
  10000000, // Level 9 to Level 10
  20000000 // Level 10 and above
]



const startDate = new Date('2024-12-03') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  const phase = Math.floor(daysDifference / 7) + 1
  return Math.min(phase)
}

const userWatchRewards = async (req, res, next) => {
  try {
   
  } catch (err) {
    logger.error(
      `Error processing rewards for telegramId: ${telegramId} - ${err.message}`
    )
    next(err)
  }
}



module.exports = {
  userWatchRewards,
}
