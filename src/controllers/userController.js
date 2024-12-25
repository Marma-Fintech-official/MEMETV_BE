const User = require('../models/userModel')
const logger = require('../helpers/logger')
const userReward = require('../models/userRewardModel')

// Function to generate a 5-character alphanumeric identifier
const generateRefId = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)
    result += characters[randomIndex]
  }
  return result
}

const levelUpBonuses = [
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

const thresholds = [
  { limit: 500, level: 1 },
  { limit: 10000, level: 2 },
  { limit: 50000, level: 3 },
  { limit: 200000, level: 4 },
  { limit: 800000, level: 5 },
  { limit: 3000000, level: 6 },
  { limit: 10000000, level: 7 },
  { limit: 25000000, level: 8 },
  { limit: 50000000, level: 9 },
  { limit: 80000000, level: 10 }
]

const milestones = [
  { referrals: 3, reward: 20000 },
  { referrals: 5, reward: 33333 },
  { referrals: 10, reward: 66667 },
  { referrals: 15, reward: 100000 },
  { referrals: 20, reward: 133333 },
  { referrals: 25, reward: 166667 },
  { referrals: 30, reward: 200000 },
  { referrals: 35, reward: 233333 },
  { referrals: 40, reward: 266667 },
  { referrals: 45, reward: 300000 },
  { referrals: 50, reward: 333333 }
]

const updateLevel = async user => {
  let currentLevel = user.level || 1
  let newLevel = currentLevel
  let newLevelUpPoints = 0

  // Loop through thresholds to determine new level
  for (const threshold of thresholds) {
    if (user.totalRewards >= threshold.limit) {
      newLevel = threshold.level
    } else {
      break
    }
  }

  // If the level has increased, calculate the level-up points
  if (newLevel > currentLevel) {
    for (let i = currentLevel; i < newLevel; i++) {
      newLevelUpPoints += levelUpBonuses[i - 1]
    }
    user.totalRewards += newLevelUpPoints
    user.levelUpRewards += newLevelUpPoints
    user.level = newLevel
  }

  // Only proceed if there are actual level-up points
  if (newLevelUpPoints > 0) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0) // Reset time to midnight for today's date

    // Check if a level-up reward record already exists for today
    const levelUpRewardRecord = await userReward.findOne({
      userId: user._id,
      category: 'levelUp',
      date: today
    })

    if (levelUpRewardRecord) {
      // If a record exists for today, update the rewardPoints
      levelUpRewardRecord.rewardPoints += newLevelUpPoints
      await levelUpRewardRecord.save()
    } else {
      // If no record exists, create a new record for today
      const newLevelUpReward = new userReward({
        category: 'levelUp',
        date: today,
        rewardPoints: newLevelUpPoints,
        userId: user._id,
        telegramId: user.telegramId
      })
      await newLevelUpReward.save()
    }
  } else {
    console.log('No level-up points to update.')
  }
}

const startDate = new Date('2024-12-03') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  const phase = Math.floor(daysDifference / 7) + 1
  return Math.min(phase)
}

const login = async (req, res, next) => {
  let { name, referredById, telegramId } = req.body

  try {
    name = name.trim()
    telegramId = telegramId.trim()
    const refId = generateRefId() // Generate a refId for new users
    let user = await User.findOne({ telegramId })
    const currentDate = new Date()
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0) // Set today's date at midnight for consistency

    // Extract current year, month, and day
    const currentYear = currentDate.getUTCFullYear()
    const currentMonth = currentDate.getUTCMonth()
    const currentDay = currentDate.getUTCDate()

    // Calculate the current phase
    const currentPhase = calculatePhase(currentDate, startDate)

    let referringUser = null
    if (referredById) {
      referringUser = await User.findOne({ refId: referredById })

      if (!referringUser) {
        referredById = '' // Reset if referring user is not found
        console.error('Referring user not found')
      }
    }

    if (!user) {
      // New user registration logic
      user = new User({
        name,
        telegramId,
        refId,
        referredById,
        totalRewards: 500,
        referRewards: 0,
        boosters: [{ type: 'levelUp', count: 1 }], // Initialize booster here for new users
        lastLogin: currentDate,
        level: 1,
        levelUpRewards: 500
      })

      await user.save()

      // Referral logic for referringUser if applicable
      if (referringUser) {
        if (!referringUser.refferalIds) {
          referringUser.refferalIds = [] // Initialize if undefined
        }

        referringUser.refferalIds.push({ userId: user._id })

        referringUser.totalRewards += 10000
        referringUser.referRewards += 10000

        const numberOfReferrals = referringUser.refferalIds.length
        let milestoneReward = 0

        // Check for milestone rewards
        for (const milestone of milestones) {
          if (numberOfReferrals === milestone.referrals) {
            milestoneReward += milestone.reward
          }
        }

        if (milestoneReward > 0) {
          referringUser.totalRewards += milestoneReward
          referringUser.referRewards += milestoneReward
        }

        const twoXBooster = referringUser.boosters.find(
          booster => booster.type === '2x'
        )
        if (twoXBooster) {
          twoXBooster.count += 5
        } else {
          referringUser.boosters.push({ type: '2x', count: 5 })
        }

        updateLevel(referringUser)
        await referringUser.save()

        // Update the reward points for the referring user
        const referRewardRecord = await userReward.findOne({
          userId: referringUser._id,
          category: 'refer',
          date: today
        })

        if (referRewardRecord) {
          // If a record exists for today, update the rewardPoints
          referRewardRecord.rewardPoints += 10000 + milestoneReward
          await referRewardRecord.save()
        } else {
          // If no record exists, create a new record for today
          const newReward = new userReward({
            category: 'refer',
            date: today,
            rewardPoints: 10000 + milestoneReward,
            userId: referringUser._id,
            telegramId: referringUser.telegramId
          })
          await newReward.save()
        }
      }
    } else {
      // Existing user login logic
      const lastLoginDate = new Date(user.lastLogin)
      const lastLoginDay = lastLoginDate.getUTCDate()
      const lastLoginMonth = lastLoginDate.getUTCMonth()
      const lastLoginYear = lastLoginDate.getUTCFullYear()

      if (
        currentYear > lastLoginYear ||
        currentMonth > lastLoginMonth ||
        currentDay > lastLoginDay
      ) {
        const levelUpBooster = user.boosters.find(
          booster => booster.type === 'levelUp'
        )

        if (levelUpBooster) {
          levelUpBooster.count += 1
        } else {
          user.boosters.push({ type: 'levelUp', count: 1 })
        }
      }

      user.lastLogin = currentDate
      await user.save()
    }

    // Update the levelUp rewards in userReward model
    const levelUpRewardRecord = await userReward.findOne({
      userId: user._id,
      category: 'levelUp',
      date: today
    })

    if (levelUpRewardRecord) {
      // If a record exists for today, update the rewardPoints
      levelUpRewardRecord.rewardPoints += 500 // Adding default rewardPoints (500) if not already present
      await levelUpRewardRecord.save()
    } else {
      // If no record exists, create a new record for today with default rewardPoints
      const newReward = new userReward({
        category: 'levelUp',
        date: today,
        rewardPoints: 500, // Default rewardPoints
        userId: user._id,
        telegramId: user.telegramId
      })
      await newReward.save()
    }

    updateLevel(user)

    res.status(201).json({
      message: `User logged in successfully`,
      user,
      currentPhase
    })
  } catch (err) {
    logger.error(
      `Error processing task rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    )
    next(err)
  }
}

const userGameRewards = async (req, res, next) => {
  try {
    const { telegramId, boosters, gamePoints } = req.body

    // Get the current date and time
    const now = new Date()
    const currentDateString = now.toISOString().split('T')[0] // "YYYY-MM-DD"

    logger.info(
      `Received request to add game rewards for user with telegramId: ${telegramId}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if the current date is earlier than the last update date
    if (user.gameRewards && user.gameRewards.createdAt) {
      const lastUpdateDate = new Date(user.gameRewards.createdAt)
      const lastUpdateDateString = lastUpdateDate.toISOString().split('T')[0]

      if (currentDateString < lastUpdateDateString) {
        logger.warn(
          `Attempt to update game rewards to an earlier date for user ${telegramId}`
        )
        return res.status(403).json({
          message: `Game Rewards cannot be updated to an earlier date.`,
          user
        })
      }
    }

    // Update game points
    if (gamePoints) {
      const points = parseInt(gamePoints, 10)
      if (!isNaN(points) && points > 0) {
        user.gameRewards.gamePoints += points
        user.gameRewards.createdAt = now

        // Add gamePoints to totalRewards
        user.totalRewards += points

        // Check for an existing userReward record for today and category "game"
        let reward = await userReward.findOne({
          telegramId,
          date: currentDateString,
          category: 'game'
        })

        if (reward) {
          // Update the rewardPoints for today's record
          reward.rewardPoints += points
          await reward.save()
          logger.info(
            `Updated userReward for user ${telegramId} on ${currentDateString}`
          )
        } else {
          // Create a new userReward record for today
          reward = new userReward({
            category: 'game',
            date: currentDateString,
            rewardPoints: points,
            userId: user._id,
            telegramId
          })
          await reward.save()
          logger.info(
            `Created new userReward for user ${telegramId} on ${currentDateString}`
          )
        }

        logger.info(`Added ${points} gamePoints to user ${telegramId}`)
      } else {
        logger.warn(`Invalid gamePoints value: ${gamePoints}`)
      }
    }

    // Update boosters
    if (Array.isArray(boosters) && boosters.length > 0) {
      const boosterCounts = boosters.reduce((acc, booster) => {
        acc[booster] = (acc[booster] || 0) + 1
        return acc
      }, {})

      user.boosters = user.boosters.map(booster => {
        if (boosterCounts[booster.type]) {
          booster.count += boosterCounts[booster.type]
          delete boosterCounts[booster.type] // Remove processed booster type
        }
        return booster
      })

      // Add new booster types
      for (const [type, count] of Object.entries(boosterCounts)) {
        user.boosters.push({ type, count })
      }

      logger.info(`Updated boosters for user ${telegramId}`)
    }

    // Update the user's level and levelUpRewards based on the new totalRewards
    updateLevel(user, currentDateString)

    // Save the updated user
    await user.save()
    logger.info(`Successfully updated game rewards for user ${telegramId}`)

    return res
      .status(200)
      .json({ message: 'Game rewards updated successfully', user })
  } catch (err) {
    logger.error(
      `Error processing game rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    )
    next(err)
  }
}

const userTaskRewards = async (req, res, next) => {
  try {
    const { telegramId, taskPoints, channel } = req.body;

    logger.info(
      `Received request to add task rewards for user with telegramId: ${telegramId}`
    );

    // Find the user by telegramId
    const user = await User.findOne({ telegramId });

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date(); // Get current date and time
    const currentDateString = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // Ensure taskPoints is a Number
    const pointsToAdd = Number(taskPoints) || 0;

    // Check if the specific channel is already true (rewards already claimed)
    if (channel && user.taskRewards.hasOwnProperty(channel)) {
      if (user.taskRewards[channel]) {
        logger.warn(
          `Rewards for ${channel} have already been claimed by user with telegramId: ${telegramId}`
        );
        return res.status(400).json({
          message: `Rewards for ${channel} have already been claimed.`,
        });
      }
    } else {
      logger.warn(`Invalid channel: ${channel}`);
      return res.status(400).json({ message: 'Invalid channel provided.' });
    }

    // Add taskPoints to totalRewards and taskRewards
    if (pointsToAdd > 0) {
      user.totalRewards += pointsToAdd;

      // Update taskPoints within taskRewards
      user.taskRewards.taskPoints += pointsToAdd;

      // Set the specific channel to true
      user.taskRewards[channel] = true;
      logger.info(
        `Updated ${channel} to true and added ${pointsToAdd} task points for user with telegramId: ${telegramId}`
      );

      // Check for an existing userReward record for today and category "task"
      let reward = await userReward.findOne({
        telegramId,
        date: currentDateString,
        category: 'task',
      });

      if (reward) {
        // Update the rewardPoints for today's record
        reward.rewardPoints += pointsToAdd;
        await reward.save();
        logger.info(`Updated userReward for user ${telegramId} on ${currentDateString}`);
      } else {
        // Create a new userReward record for today
        reward = new userReward({
          category: 'task',
          date: currentDateString,
          rewardPoints: pointsToAdd,
          userId: user._id,
          telegramId,
        });
        await reward.save();
        logger.info(`Created new userReward for user ${telegramId} on ${currentDateString}`);
      }

      logger.info(`Added ${pointsToAdd} taskPoints to user ${telegramId}`);
    }

    // Update the user's level and levelUpRewards based on the new totalRewards
    updateLevel(user, currentDateString);

    // Save the updated user document
    await user.save();

    logger.info(
      `Successfully added taskPoints and updated channel for user with telegramId: ${telegramId}`
    );

    return res
      .status(200)
      .json({ message: 'TaskPoints added successfully', user });
  } catch (err) {
    logger.error(
      `Error processing task rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    );
    next(err);
  }
};


module.exports = {
  login,
  userGameRewards,
  userTaskRewards
}
