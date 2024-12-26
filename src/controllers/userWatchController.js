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

    // Watch rewards and level-up logic (unchanged from your current logic)
    let remainingSeconds = userWatchSeconds
    let newRewards = 0
    let currentTotalRewards = user.totalRewards
    let previousLevel = user.level

    // Calculate rewards based on user level
    if (user.level < 10) {
      while (remainingSeconds > 0) {
        let rewardPerSecond
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (currentTotalRewards >= thresholds[i].limit) {
            rewardPerSecond = thresholds[i].rewardPerSecond
            break
          }
        }

        let nextThreshold = thresholds.find(t => t.limit > currentTotalRewards)
        let secondsAtThisRate = nextThreshold
          ? Math.min(
              remainingSeconds,
              nextThreshold.limit - currentTotalRewards
            )
          : remainingSeconds

        newRewards += secondsAtThisRate * rewardPerSecond
        currentTotalRewards += secondsAtThisRate
        remainingSeconds -= secondsAtThisRate
      }
    } else {
      const level10RewardPerSecond = thresholds.find(
        t => t.level === 10
      ).rewardPerSecond
      newRewards = remainingSeconds * level10RewardPerSecond
    }

    logger.info(
      `Rewards calculated for telegramId: ${telegramId}, newRewards: ${newRewards}`
    )

    const parsedBoosterPoints = parseFloat(boosterPoints)
    user.totalRewards += newRewards + parsedBoosterPoints

    let newLevel = 1
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (user.totalRewards >= thresholds[i].limit) {
        newLevel = thresholds[i].level
        break
      }
    }

    let levelUpBonus = 0

    if (newLevel > previousLevel) {
      for (let level = previousLevel; level < newLevel; level++) {
        let bonusIndex = level - 1
        if (bonusIndex >= 0 && bonusIndex < levelUpBonuses.length) {
          levelUpBonus += levelUpBonuses[bonusIndex]
        }
      }
    }

    logger.info(
      `Level-up bonus calculated for telegramId: ${telegramId}, levelUpBonus: ${levelUpBonus}`
    )

    user.level = newLevel
    user.totalRewards += levelUpBonus

    
    // Update watchRewards and levelUpRewards
    user.watchRewards =
      (user.watchRewards || 0) + newRewards + parsedBoosterPoints
    user.levelUpRewards = (user.levelUpRewards || 0) + levelUpBonus

    // Replicate today's watchRewards into voteDetails.votesCount
    const todayWatchRewards = newRewards + parsedBoosterPoints

  






  



  

    await user.save()

    logger.info(
      `Rewards, level, and vote details updated successfully for telegramId: ${telegramId}`
    )

    res.status(200).json({
      message: 'Rewards, level, and vote details updated successfully',
      name: user.name,
      telegramId: user.telegramId,
      totalRewards: user.totalRewards,
    })
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
