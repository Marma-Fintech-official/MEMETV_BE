const User = require('../models/userModel')
const {
  levelUpBonuses,
  thresholds,
  milestones
} = require('../helpers/constants')
const userReward = require('../models/userRewardModel')
const logger = require('../helpers/logger')

const startDate = new Date('2024-12-03') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  const phase = Math.floor(daysDifference / 7) + 1
  return Math.min(phase)
}

const userWatchRewards = async (req, res, next) => {
  try {
    const {
      telegramId,
      userWatchSeconds,
      boosterPoints = 0,
      boosters
    } = req.body

    logger.info(
      `Received request to process watch rewards for telegramId: ${telegramId}`
    )

    const now = new Date()
    const currentPhase = calculatePhase(now, startDate)
    const currentDateString = now.toISOString().split('T')[0] // "YYYY-MM-DD"

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    logger.info(`User found for telegramId: ${telegramId}`)
  } catch (err) {
    logger.error(
      `Error processing rewards for telegramId: ${telegramId} - ${err.message}`
    )
    next(err)
  }
}

module.exports = {
  userWatchRewards
}
