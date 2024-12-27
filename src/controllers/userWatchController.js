const User = require('../models/userModel')
const userReward = require('../models/userRewardModel')
const userDailyreward = require('../models/userDailyrewardsModel')
const { levelUpBonuses, thresholds } = require('../helpers/constants')
const logger = require('../helpers/logger')

const startDate = new Date('2024-12-03') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  const phase = Math.floor(daysDifference / 7) + 1
  return Math.min(phase)
}

const updateUserDailyReward = async (
  userId,
  telegramId,
  dailyEarnedRewards,
  levelUpRewards = 0
) => {
  const now = new Date()
  const currentDateString = now.toISOString().split('T')[0] // "YYYY-MM-DD"

  try {
    // Check if a daily reward record already exists for today
    let dailyReward = await userDailyreward.findOne({
      userId: userId,
      telegramId: telegramId,
      createdAt: {
        $gte: new Date(currentDateString),
        $lt: new Date(new Date(currentDateString).setDate(now.getDate() + 1))
      }
    })

    const totalDailyRewards = dailyEarnedRewards + levelUpRewards // Combine both earned rewards and level-up rewards

    if (dailyReward) {
      // If a record exists, update the dailyEarnedRewards including levelUpRewards
      dailyReward.dailyEarnedRewards += totalDailyRewards
      await dailyReward.save()
      logger.info(
        `Updated daily reward for telegramId: ${telegramId} on ${currentDateString}, totalRewards: ${dailyReward.dailyEarnedRewards}`
      )
    } else {
      // If no record exists, create a new one with combined rewards
      dailyReward = new userDailyreward({
        userId,
        telegramId,
        dailyEarnedRewards: totalDailyRewards,
        createdAt: new Date(currentDateString)
      })
      await dailyReward.save()
      logger.info(
        `Created new daily reward for telegramId: ${telegramId} on ${currentDateString}, dailyEarnedRewards: ${totalDailyRewards}`
      )
    }
  } catch (error) {
    logger.error(
      `Error updating daily rewards for telegramId: ${telegramId} - ${error.message}`
    )
  }
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

    const totalWatchRewardPoints = newRewards + parsedBoosterPoints // Calculate total reward points by adding newRewards and boosterPoints

    if (watchReward) {
      watchReward.rewardPoints += totalWatchRewardPoints // Add total reward points (including boosterPoints)
      await watchReward.save()
      logger.info(
        `Updated watch reward for user ${telegramId} on ${currentDateString}, totalRewardPoints: ${totalWatchRewardPoints}`
      )
    } else {
      watchReward = new userReward({
        category: 'watch',
        date: currentDateString,
        rewardPoints: totalWatchRewardPoints, // Set the total reward points here
        userId: user._id,
        telegramId
      })
      await watchReward.save()
      logger.info(
        `Created new watch reward for user ${telegramId} on ${currentDateString}, totalRewardPoints: ${totalWatchRewardPoints}`
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

    // Call the updateUserDailyReward function to handle daily rewards
    await updateUserDailyReward(
      user._id,
      telegramId,
      totalRewards,
      levelUpBonus
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

const userDetails = async (req, res, next) => {
  try {
    let { telegramId } = req.params

    // Trim leading and trailing spaces
    telegramId = telegramId.trim()

    logger.info(
      `Received request for user details with telegramId: ${telegramId}`
    )

    // Find the user detail document for the given telegramId
    const userDetail = await User.findOne({ telegramId: telegramId })

    // Check if user detail was found
    if (!userDetail) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    logger.info(
      `User details retrieved successfully for telegramId: ${telegramId}`
    )

    // Calculate the current phase
    const currentDate = new Date()
    const currentPhase = calculatePhase(currentDate, startDate)

    // Add the currentPhase to the user details
    const response = {
      ...userDetail._doc, // Spread the user detail fields
      currentPhase: currentPhase // Add the calculated phase
    }

    // Return the user details with the current phase in the response
    return res.status(200).json(response)
  } catch (err) {
    logger.error(
      `Error processing rewards for telegramId: ${telegramId || 'unknown'} - ${
        err.message
      }`
    )
    next(err)
  }
}

const boosterDetails = async (req, res, next) => {
  try {
    let { telegramId } = req.params

    // Log the incoming request
    logger.info(
      `Received request to fetch booster details for telegramId: ${telegramId}`
    )

    // Trim leading and trailing spaces
    telegramId = telegramId.trim()

    // Find the user detail document for the given telegramId
    const userDetail = await User.findOne({ telegramId: telegramId })

    // Check if user detail was found
    if (!userDetail) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Log successful retrieval of user details
    logger.info(
      `User Boosters Details fetched successfully for telegramId: ${telegramId}`
    )

    // Return the boosters array along with other relevant user details
    res.status(200).json({
      message: 'User Boosters Details fetched successfully',
      boosters: userDetail.boosters
    })
  } catch (err) {
    logger.error(
      `Error fetching booster details for telegramId: ${telegramId} - ${err.message}`
    )
    next(err)
  }
}

const popularUser = async (req, res, next) => {
  try {
    let { telegramId } = req.params

    // Trim leading and trailing spaces
    telegramId = telegramId.trim()

    // Log the incoming request
    logger.info(
      `Received request to retrieve popular user data for telegramId: ${telegramId}`
    )

    // Retrieve all users sorted by totalRewards in descending order
    const allUsers = await User.find().sort({ balanceRewards: -1 })

    // Find the rank of the specific user
    const userIndex = allUsers.findIndex(user => user.telegramId === telegramId)

    if (userIndex === -1) {
      logger.warn(`User with telegramId: ${telegramId} not found`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Get the user details and rank
    const userDetail = allUsers[userIndex]
    const userRank = userIndex + 1 // Rank is index + 1

    // Log the user rank and details
    logger.info(
      `User found: telegramId: ${telegramId}, rank: ${userRank}, totalRewards: ${userDetail.balanceRewards}`
    )

    // Format user details
    const userFormattedDetail = {
      rank: userRank,
      telegramId: userDetail.telegramId,
      name: userDetail.name,
      level: userDetail.level,
      balanceRewards: userDetail.balanceRewards
    }

    // Get the top 10 users
    const topUsers = allUsers.slice(0, 10).map((user, index) => ({
      rank: index + 1,
      telegramId: user.telegramId,
      name: user.name,
      level: user.level,
      balanceRewards: user.balanceRewards
    }))

    // Log the top 100 users retrieval
    logger.info('Retrieved top 100 users successfully')

    res.status(200).json({
      topUsers,
      yourDetail: userFormattedDetail
    })
  } catch (err) {
    logger.error(
      `Error retrieving popular user data for telegramId: ${telegramId} - ${err.message}`
    )
    next(err)
  }
}

const yourReferrals = async (req, res, next) => {
  try {
    let { telegramId } = req.params
    telegramId = telegramId.trim()

    // Log the incoming request
    logger.info(
      `Received request to retrieve referrals for telegramId: ${telegramId}`
    )

    // Get pagination parameters from query, set defaults if not provided
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    // Log pagination details
    logger.info(
      `Pagination details - Page: ${page}, Limit: ${limit}, Skip: ${skip}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    if (!user) {
      logger.warn(`User with telegramId: ${telegramId} not found`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Log the number of referrals
    const totalReferrals = user.refferalIds.length
    logger.info(`User found - Total Referrals: ${totalReferrals}`)

    // Extract the userIds from the refferalIds array
    const paginatedReferenceIds = user.refferalIds.slice(
      skip,
      skip + limit
    )

    const userIds = paginatedReferenceIds.map(ref => ref.userId)

    // Find the referenced users and select the required fields
    const referencedUsers = await User.find({ _id: { $in: userIds } }).select(
      'name totalRewards'
    )

    // Log the number of referenced users found
    logger.info(`Referenced users found: ${referencedUsers.length}`)

    // Create a map of referenced users by their ID for quick lookup
    const userMap = new Map()
    referencedUsers.forEach(refUser => {
      userMap.set(refUser._id.toString(), refUser)
    })

    // Construct the referrals response
    const referrals = paginatedReferenceIds.map(ref => {
      const refUser = userMap.get(ref.userId.toString())
      return {
        userId: ref.userId,
        name: refUser ? refUser.name : 'Unknown', // Handle case where referenced user is not found
        totalRewards: refUser ? refUser.totalRewards : 0, // Handle case where referenced user is not found
        createdAt: ref.createdAt
      }
    })

    // Log the response details
    logger.info(
      `Referrals retrieved successfully for telegramId: ${telegramId}`
    )

    res.status(200).json({
      referrals,
      total: totalReferrals,
      page,
      limit,
      totalPages: Math.ceil(totalReferrals / limit)
    })
  } catch (err) {
    logger.error(
      `Error retrieving referrals for telegramId: ${telegramId} - ${err.message}`
    )
    next(err)
  }
}

const tutorialStatus = async (req, res, next) => {
  try {
    const { telegramId } = req.params;
    const { tutorialStatus } = req.body;

    // Find the user by telegramId and update the tutorialStatus
    const updatedUser = await User.findOneAndUpdate(
      { telegramId },
      { tutorialStatus },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Tutorial status updated successfully', user: updatedUser });
  } catch (err) {
    next(err);
  }
};



module.exports = {
  userWatchRewards,
  userDetails,
  boosterDetails,
  popularUser,
  yourReferrals,
  tutorialStatus
}
