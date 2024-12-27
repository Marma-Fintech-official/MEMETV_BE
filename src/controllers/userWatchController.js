const User = require('../models/userModel')
const userReward = require('../models/userRewardModel')
const { levelUpBonuses, thresholds } = require('../helpers/constants')

const logger = require('../helpers/logger')

const startDate = new Date('2024-12-03') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  const phase = Math.floor(daysDifference / 7) + 1
  return Math.min(phase)
}

const userWatchRewards = async (req, res, next) => {
  let telegramId // Declare telegramId outside the try block for accessibility
  try {
    const {
      telegramId: id,
      userWatchSeconds,
      boosterPoints = 0,
      boosters = []
    } = req.body
    telegramId = id // Assign the value to the outer-scoped variable

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

    let remainingSeconds = userWatchSeconds
    let newRewards = 0
    let currentTotalRewards = user.totalRewards
    const parsedBoosterPoints = parseFloat(boosterPoints)
    const previousLevel = user.level

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

        const nextThreshold = thresholds.find(
          t => t.limit > currentTotalRewards
        )
        const secondsAtThisRate = nextThreshold
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

    const totalRewards = newRewards + parsedBoosterPoints

    // Update user rewards
    user.totalRewards += totalRewards
    user.balanceRewards += totalRewards
    user.watchRewards = (user.watchRewards || 0) + totalRewards

    // Add a userReward entry for "watch"
    let watchReward = await userReward.findOne({
      telegramId,
      date: currentDateString,
      category: 'watch'
    })

    if (watchReward) {
      watchReward.rewardPoints += newRewards
      await watchReward.save()
      logger.info(
        `Updated watch reward for user ${telegramId} on ${currentDateString}`
      )
    } else {
      watchReward = new userReward({
        category: 'watch',
        date: currentDateString,
        rewardPoints: newRewards,
        userId: user._id,
        telegramId
      })
      await watchReward.save()
      logger.info(
        `Created new watch reward for user ${telegramId} on ${currentDateString}`
      )
    }

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
        const bonusIndex = level - 1
        if (bonusIndex >= 0 && bonusIndex < levelUpBonuses.length) {
          levelUpBonus += levelUpBonuses[bonusIndex]
        }
      }
    }

    logger.info(
      `Level-up bonus calculated for telegramId: ${telegramId}, levelUpBonus: ${levelUpBonus}`
    )

    // Update user level and add level-up bonus
    user.level = newLevel
    user.totalRewards += levelUpBonus
    user.balanceRewards += levelUpBonus
    user.levelUpRewards = (user.levelUpRewards || 0) + levelUpBonus

    // Add a userReward entry for "levelUp"
    if (levelUpBonus > 0) {
      let levelUpReward = await userReward.findOne({
        telegramId,
        date: currentDateString,
        category: 'levelUp'
      })

      if (levelUpReward) {
        levelUpReward.rewardPoints += levelUpBonus
        await levelUpReward.save()
        logger.info(
          `Updated level-up reward for user ${telegramId} on ${currentDateString}`
        )
      } else {
        levelUpReward = new userReward({
          category: 'levelUp',
          date: currentDateString,
          rewardPoints: levelUpBonus,
          userId: user._id,
          telegramId
        })
        await levelUpReward.save()
        logger.info(
          `Created new level-up reward for user ${telegramId} on ${currentDateString}`
        )
      }
    }

    // Remove booster counts
    boosters.forEach(boosterType => {
      const userBooster = user.boosters.find(b => b.type === boosterType)
      if (userBooster && userBooster.count > 0) {
        userBooster.count -= 1
        if (userBooster.count === 0) {
          // Optionally, remove the booster from the array if count reaches 0
          user.boosters = user.boosters.filter(b => b.count > 0)
        }
      }
    })

    // Save user data
    await user.save()

    logger.info(
      `User rewards and boosters updated successfully for telegramId: ${telegramId}`
    )

    return res.status(200).json({
      message: 'Watch rewards processed successfully',
      totalRewards: user.totalRewards,
      balanceRewards: user.balanceRewards,
      level: user.level,
      levelUpRewards: user.levelUpRewards,
      watchRewards: user.watchRewards,
      currentPhase: currentPhase
    })
  } catch (err) {
    logger.error(
      `Error processing rewards for telegramId: ${telegramId || 'unknown'} - ${
        err.message
      }`
    )
    next(err)
  }
}

module.exports = {
  userWatchRewards
}
