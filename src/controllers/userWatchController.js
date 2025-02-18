const User = require('../models/userModel')
const userReward = require('../models/userRewardModel')
const userDailyreward = require('../models/userDailyrewardsModel')
const { levelUpBonuses, thresholds } = require('../helpers/constants')
const logger = require('../helpers/logger')
const { decryptedDatas } = require('../helpers/Decrypt')
const startDate = new Date('2025-01-09') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  if (daysDifference < 0) return 0 // Before start date
  return Math.ceil(daysDifference / 7)
}

const TOTALREWARDS_LIMIT = 21000000000

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
  } catch (err) {
    logger.error(
      `Error updating daily rewards for telegramId: ${telegramId} - ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    })
    next(err)
  }
}

const userWatchRewards = async (req, res, next) => {
  try {
    const { telegramId, userWatchSeconds, boosterPoints, boosters } =
      decryptedDatas(req)

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

    const totalWatchRewards = newRewards + parsedBoosterPoints

    // Calculate the available space for rewards
    const totalRewardsInSystem = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
    ])

    const totalRewardsUsed = totalRewardsInSystem[0]
      ? totalRewardsInSystem[0].total
      : 0
    const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

    if (availableSpace <= 0) {
      return res.status(403).json({
        message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
      })
    }

    // Calculate how much of the watchRewards can be added
    const watchRewardsToAdd = Math.min(totalWatchRewards, availableSpace)
    user.totalRewards += watchRewardsToAdd
    user.balanceRewards += watchRewardsToAdd
    user.watchRewards = (user.watchRewards || 0) + watchRewardsToAdd

    // Add a userReward entry for "watch"
    let watchReward = await userReward.findOne({
      telegramId,
      date: currentDateString,
      category: 'watch'
    })

    if (watchReward) {
      watchReward.rewardPoints += watchRewardsToAdd
      await watchReward.save()
      logger.info(
        `Updated watch reward for user ${telegramId} on ${currentDateString}, totalRewardPoints: ${watchRewardsToAdd}`
      )
    } else {
      watchReward = new userReward({
        category: 'watch',
        date: currentDateString,
        rewardPoints: watchRewardsToAdd,
        userId: user._id,
        telegramId
      })
      await watchReward.save()
      logger.info(
        `Created new watch reward for user ${telegramId} on ${currentDateString}, totalRewardPoints: ${watchRewardsToAdd}`
      )
    }

    // Level-up logic
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

    // Calculate the available space for levelUpRewards
    const availableLevelUpSpace = TOTALREWARDS_LIMIT - user.totalRewards

    // Calculate how much of the levelUpRewards can be added
    const levelUpRewardsToAdd = Math.min(levelUpBonus, availableLevelUpSpace)
    user.level = newLevel
    user.totalRewards += levelUpRewardsToAdd
    user.balanceRewards += levelUpRewardsToAdd
    user.levelUpRewards = (user.levelUpRewards || 0) + levelUpRewardsToAdd

    // Add a userReward entry for "levelUp"
    if (levelUpRewardsToAdd > 0) {
      let levelUpReward = await userReward.findOne({
        telegramId,
        date: currentDateString,
        category: 'levelUp'
      })

      if (levelUpReward) {
        levelUpReward.rewardPoints += levelUpRewardsToAdd
        await levelUpReward.save()
        logger.info(
          `Updated level-up reward for user ${telegramId} on ${currentDateString}`
        )
      } else {
        levelUpReward = new userReward({
          category: 'levelUp',
          date: currentDateString,
          rewardPoints: levelUpRewardsToAdd,
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
    boosters?.forEach(booster => {
      const userBooster = user.boosters.find(b => b.type === booster.type)
      if (userBooster && userBooster.count > 0) {
        userBooster.count -= booster.count // Subtract the count sent in req.body
        if (userBooster.count <= 0) {
          // Remove the booster from the array if count reaches 0
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
      totalWatchRewards,
      levelUpRewardsToAdd
    )

    return res.status(200).json({
      message: 'Watch rewards processed successfully',
      totalRewards: user.totalRewards,
      balanceRewards: user.balanceRewards,
      level: user.level,
      levelUpRewards: user.levelUpRewards,
      watchRewards: user.watchRewards,
      currentPhase: currentPhase,
      boosters: user.boosters
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
    res.status(500).json({
      message: 'Something went wrong'
    })
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
    res.status(500).json({
      message: 'Something went wrong'
    })

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
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

    // Get the top 100 users
    const topUsers = allUsers.slice(0, 100).map((user, index) => ({
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
    res.status(500).json({
      message: 'Something went wrong'
    })

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
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
    // console.log(user);

    if (!user) {
      logger.warn(`User with telegramId: ${telegramId} not found`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Log the number of referrals
    const totalReferrals = user.refferalIds.length
    logger.info(`User found - Total Referrals: ${totalReferrals}`)

    // Extract the userIds from the refferalIds array
    const paginatedReferenceIds = user.refferalIds.slice(skip, skip + limit)

    const userIds = paginatedReferenceIds.map(ref => ref.userId)

    // Find the referenced users and select the required fields
    const referencedUsers = await User.find({ _id: { $in: userIds } }).select(
      'name balanceRewards'
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
        balanceRewards: refUser ? refUser.balanceRewards : 0, // Assuming balanceRewards is part of the referral object
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
    res.status(500).json({
      message: 'Something went wrong'
    })

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err)
  }
}

const tutorialStatus = async (req, res, next) => {
  try {
    const { telegramId, tutorialStatus } = decryptedDatas(req)
    console.log(telegramId, tutorialStatus, ' telegramId, tutorialStatus')

    if (!telegramId || tutorialStatus === undefined) {
      return res.status(400).json({ message: 'Invalid payload structure' })
    }
    const updatedUser = await User.findOneAndUpdate(
      { telegramId },
      { tutorialStatus },
      { new: true }
    )
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' })
    }
    res.status(200).json({
      message: 'Tutorial status updated successfully',
      user: {
        telegramId: updatedUser.telegramId,
        tutorialStatus: updatedUser.tutorialStatus
      } // Filter response
    })
  } catch (err) {
    logger.error(`Error updating tutorial status: ${err.message}`)
    res
      .status(500)
      .json({ error: 'Something went wrong', details: err.message })
    next(err)
  }
}

const stakingHistory = async (req, res, next) => {
  try {
    const { telegramId } = req.params
    const { page = 1 } = req.query // Default to page 1 if no page is specified
    const limit = 20

    // Calculate the number of records to skip based on the page
    const skip = (page - 1) * limit

    // Find records with category "stake" and matching telegramId
    const stakeRecords = await userReward
      .find({
        telegramId: telegramId,
        category: 'stake'
      })
      .skip(skip)
      .limit(limit)

    // Get total count of records for pagination
    const totalCount = await userReward.countDocuments({
      telegramId: telegramId,
      category: 'stake'
    })

    if (!stakeRecords || stakeRecords.length === 0) {
      return res.status(404).json({
        message: `No staking history found for telegramId: ${telegramId}`
      })
    }

    res.status(200).json({
      message: `Staking history retrieved successfully for telegramId: ${telegramId}`,
      data: stakeRecords,
      pagination: {
        totalRecords: totalCount,
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(totalCount / limit),
        limit: limit
      }
    })
  } catch (err) {
    logger.error(
      `Error retrieving staking history for telegramId: ${req.params.telegramId} - ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    })

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err)
  }
}

const addWalletAddress = async (req, res, next) => {
  try {
    // Ensure decryptedData is parsed JSON
    const { telegramId, userWalletAddress } = decryptedDatas(req)
    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    if (!user) {
      // Log and return if the user is not found
      logger.error(`User with telegramId: ${telegramId} not found`)
      return res.status(404).json({
        message: 'User not found'
      })
    }

    // Update the user's wallet address (ensure correct field name)
    user.userWalletAddress = userWalletAddress // Make sure this matches the field name in your schema
    await user.save()

    // Log success and respond
    logger.info(`Wallet address updated for user: ${telegramId}`)
    return res.status(200).json({
      message: 'Wallet address updated successfully'
    })
  } catch (err) {
    logger.error(
      `Error updating wallet address for telegramId: ${telegramId} - ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    })

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err)
  }
}

const dailyRewards = async (req, res, next) => {
  try {
    let { telegramId } = req.params
    const { currentPhase = 1 } = req.query

    // Log the incoming request
    logger.info(
      `Received request to calculate daily rewards for telegramId: ${telegramId}, currentPhase: ${currentPhase}`
    )

    // Trim leading and trailing spaces
    telegramId = telegramId.trim()

    // Validate currentPhase
    const phase = parseInt(currentPhase)
    if (isNaN(phase) || phase <= 0) {
      logger.warn(`Invalid currentPhase: ${currentPhase}`)
      return res.status(400).json({ message: 'Invalid currentPhase' })
    }

    // Retrieve the user's balanceRewards from the User model
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const { balanceRewards: totalRewards } = user

    // Check if telegramId exists in userDailyreward collection
    const userExists = await userDailyreward.exists({ telegramId })
    if (!userExists) {
      logger.warn(`No records found for telegramId: ${telegramId}`)
      return res.status(200).json({
        dailyRewards: [],
        totalRewards,
        message: `No rewards found for telegramId: ${telegramId}`
      })
    }

    // Calculate the start and end dates for the requested phase
    const phaseStartDate = new Date(
      startDate.getTime() + (phase - 1) * 7 * 24 * 60 * 60 * 1000
    )
    const phaseEndDate = new Date(
      phaseStartDate.getTime() + 7 * 24 * 60 * 60 * 1000
    )

    // Fetch all daily rewards records for the current phase
    const dailyRewardsRecords = await userDailyreward.find({
      telegramId,
      createdAt: { $gte: phaseStartDate, $lt: phaseEndDate }
    })

    logger.info(
      `Successfully retrieved ${dailyRewardsRecords.length} daily rewards for telegramId: ${telegramId}, phase: ${currentPhase}`
    )

    // Generate the full 7-day range for the current phase
    const fullPhaseDates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(phaseStartDate)
      date.setDate(date.getDate() + i)
      fullPhaseDates.push(date.toISOString().split('T')[0]) // Format as YYYY-MM-DD
    }

    // Map existing records into an object keyed by date
    const recordsByDate = dailyRewardsRecords.reduce((acc, record) => {
      const dateKey = record.createdAt.toISOString().split('T')[0]
      acc[dateKey] = record
      return acc
    }, {})

    // Process the full range of dates and include missing records with default values
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset the time part

    let totalPhaseRewards = 0

    const processedRewards = fullPhaseDates.map(dateKey => {
      if (recordsByDate[dateKey]) {
        // Use existing record
        const reward = recordsByDate[dateKey]
        const stakeButton =
          today > new Date(reward.createdAt) ? 'enable' : 'disable'
        return { ...reward.toObject(), stakeButton }
      } else {
        // Add default record
        return {
          createdAt: dateKey,
          telegramId,
          dailyEarnedRewards: 0,
          stakeButton: 'disable'
        }
      }
    })

    // Return the response
    return res.status(200).json({
      dailyRewards: processedRewards,
      totalRewards
    })
  } catch (err) {
    logger.error(
      `Error fetching daily rewards for telegramId: ${telegramId} - ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    })

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err)
  }
}
module.exports = {
  userWatchRewards,
  userDetails,
  boosterDetails,
  popularUser,
  yourReferrals,
  tutorialStatus,
  stakingHistory,
  addWalletAddress,
  dailyRewards
}
