const fs = require('fs')
const User = require('../models/userModel') // Adjust the path as necessary
const UserDailyReward = require('../models/userDailyrewardsModel')
const UserReward = require('../models/userRewardModel')
const logger = require('../helpers/logger')
require('dotenv').config()
const { decryptedDatas } = require('../helpers/Decrypt')
const TOTALREWARDS_LIMIT = 21000000000

// Update or create daily earned rewards
const updateDailyEarnedRewards = async (userId, telegramId, reward) => {
  try {
    const today = new Date().toISOString().split('T')[0] // Get today's date in YYYY-MM-DD format

    // Find or create a daily reward record for today
    let dailyReward = await UserDailyReward.findOne({
      userId,
      telegramId,
      createdAt: { $gte: new Date(today) }
    })

    if (dailyReward) {
      // Update the existing daily reward
      dailyReward.dailyEarnedRewards += reward
      dailyReward.updatedAt = new Date()
    } else {
      // Create a new record if none exists for today
      dailyReward = new UserDailyReward({
        userId,
        telegramId,
        dailyEarnedRewards: reward,
        createdAt: new Date()
      })
    }

    await dailyReward.save() // Save the record

    console.log(
      dailyReward.dailyEarnedRewards === reward
        ? `New daily reward record created for ${telegramId}.`
        : `Daily rewards updated for ${telegramId}: ${reward} added.`
    )
  } catch (error) {
    console.error(
      `Error updating daily rewards for user ${telegramId}: ${error.message}`
    )
  }
}

const savePromoReward = async (user, rewardPoints) => {
  try {
    const today = new Date().toISOString().split('T')[0] // Today's date in YYYY-MM-DD

    // Check if a reward record already exists for today
    let rewardRecord = await UserReward.findOne({
      userId: user._id,
      telegramId: user.telegramId,
      category: 'promo',
      date: new Date(today)
    })

    if (rewardRecord) {
      // If record exists, increment rewardPoints
      rewardRecord.rewardPoints += rewardPoints
      rewardRecord.updatedAt = new Date()
      await rewardRecord.save()

      console.log(
        `Updated today's promo reward for user ${user.telegramId}. Total: ${rewardRecord.rewardPoints}`
      )
    } else {
      // If no record exists, create a new one
      rewardRecord = new UserReward({
        category: 'promo',
        date: new Date(today),
        rewardPoints: rewardPoints,
        userId: user._id,
        telegramId: user.telegramId
      })
      await rewardRecord.save()

      console.log(
        `Created new promo reward record for user ${user.telegramId} with ${rewardPoints} points.`
      )
    }
  } catch (error) {
    console.error(`Error saving promo reward: ${error.message}`)
  }
}

// Load promo codes from file
const promoCodes = JSON.parse(
  fs.readFileSync('./src/PromoCodes/promoCodes.json', 'utf-8')
)

const validatePromocode = async (req, res) => {
  const { telegramId, promoCode } = decryptedDatas(req)
  console.log(telegramId, promoCode)

  if (!telegramId || !promoCode) {
    return res
      .status(400)
      .json({ message: 'Telegram ID and promo code are required.' })
  }

  try {
    const user = await User.findOne({ telegramId })
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    // Check if the promo code is valid
    const validPromo = promoCodes.find(p => p.promoCode === promoCode)
    if (!validPromo) {
      return res.status(400).json({ message: 'Invalid promo code.' })
    }
    if (validPromo.status) {
      return res.status(400).json({ message: 'Promo code already used.' })
    }
    // Calculate the available space for total rewards globally
    const totalRewardsInSystem = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
    ])
    const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
    const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

    if (availableSpace <= 0) {
      logger.warn(
        `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
      )
      return res.status(403).json({
        message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
      })
    }

    // Calculate the points user can claim without exceeding limits
    const allowedPoints = Math.min(validPromo.reward, availableSpace)

    // Update user rewards
    user.balanceRewards += allowedPoints
    user.promoRewards += allowedPoints
    user.totalRewards += allowedPoints
    user.usedPromoCodes = user.usedPromoCodes || []
    user.usedPromoCodes.push(promoCode)

    // Update daily earned rewards
    await updateDailyEarnedRewards(user._id, telegramId, allowedPoints)
    await savePromoReward(user, allowedPoints)

    // Mark promo code as used
    validPromo.status = true
    fs.writeFileSync(
      './src/PromoCodes/promoCodes.json',
      JSON.stringify(promoCodes, null, 2)
    )

    // Save the updated user
    await user.save()

    return res.status(200).json({
      message: 'Promo code validated and reward added.',
      balanceRewards: user.balanceRewards,
      totalRewards: user.totalRewards,
      promoReward: validPromo.reward,
      claimedReward: allowedPoints
    })
  } catch (err) {
    logger.error(
      `Error processing rewards for telegramId: ${telegramId || 'unknown'} - ${
        err.message
      }`
    )
    res.status(500).json({
      message: 'Something went wrong'
    })
    next(err)
  }
}

module.exports = { validatePromocode }
