const User = require('../models/userModel')
const logger = require('../helpers/logger')
const userReward = require('../models/userRewardModel')
const userDailyreward = require('../models/userDailyrewardsModel')
const mongoose = require('mongoose')
const { isValidObjectId } = mongoose
const {
  levelUpBonuses,
  thresholds,
  milestones
} = require('../helpers/constants')

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

const updateLevel = async user => {
  let currentLevel = user.level || 1;
  let newLevel = currentLevel;
  let newLevelUpPoints = 0;

  // Loop through thresholds to determine new level
  for (const threshold of thresholds) {
    if (user.balanceRewards >= threshold.limit) {
      newLevel = threshold.level;
    } else {
      break;
    }
  }

  // If the level has increased, calculate the level-up points
  if (newLevel > currentLevel) {
    for (let i = currentLevel; i < newLevel; i++) {
      newLevelUpPoints += levelUpBonuses[i - 1];
    }
    user.totalRewards += newLevelUpPoints;
    user.balanceRewards += newLevelUpPoints;
    user.levelUpRewards += newLevelUpPoints;
    user.level = newLevel;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // Reset time to midnight for today's date

  // Check if the user has earned level-up points that need to be recorded for today
  const levelUpRewardRecord = await userReward.findOne({
    userId: user._id,
    category: 'levelUp',
    date: today
  });

  if (!levelUpRewardRecord && newLevelUpPoints > 0) {
    const newLevelUpReward = new userReward({
      category: 'levelUp',
      date: today,
      rewardPoints: newLevelUpPoints,
      userId: user._id,
      telegramId: user.telegramId
    });
    await newLevelUpReward.save();
  } else if (levelUpRewardRecord && newLevelUpPoints > 0) {
    levelUpRewardRecord.rewardPoints += newLevelUpPoints;
    await levelUpRewardRecord.save();
  }

  // Reflect levelUpRewards in the userDailyreward model
  if (newLevelUpPoints > 0) {
    let dailyReward = await userDailyreward.findOne({
      userId: user._id,
      createdAt: { $gte: new Date(today) }
    });

    if (dailyReward) {
      dailyReward.dailyEarnedRewards += newLevelUpPoints;
      await dailyReward.save();
    } else {
      // Create a new daily reward record if none exists
      dailyReward = new userDailyreward({
        userId: user._id,
        telegramId: user.telegramId,
        dailyEarnedRewards: newLevelUpPoints,
        createdAt: today
      });
      await dailyReward.save();
    }
  }
};

const startDate = new Date('2024-12-03') // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000
  const daysDifference = Math.floor((currentDate - startDate) / oneDay)
  const phase = Math.floor(daysDifference / 7) + 1
  return Math.min(phase)
}

const login = async (req, res, next) => {
  let { name, referredById, telegramId } = req.body;

  try {
    name = name.trim();
    telegramId = telegramId.trim();
    const refId = generateRefId(); // Generate a refId for new users
    let user = await User.findOne({ telegramId });
    const currentDate = new Date();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Set today's date at midnight for consistency

    const currentPhase = calculatePhase(currentDate, startDate);

    let referringUser = null;
    if (referredById) {
      referringUser = await User.findOne({ refId: referredById });

      if (!referringUser) {
        referredById = ''; // Reset if referring user is not found
        console.error('Referring user not found');
      }
    }

    let totalDailyReward = 0;

    if (!user) {
      // New user registration logic
      user = new User({
        name,
        telegramId,
        refId,
        referredById,
        totalRewards: 500,
        balanceRewards: 500,
        referRewards: 0,
        boosters: [{ type: 'levelUp', count: 1 }], // Initialize booster here for new users
        lastLogin: currentDate,
        level: 1,
        levelUpRewards: 500
      });

      await user.save();

      // Add level-up reward for the new user
      const newLevelUpReward = new userReward({
        category: 'levelUp',
        date: today,
        rewardPoints: 500,
        userId: user._id,
        telegramId: user.telegramId
      });
      await newLevelUpReward.save();

      totalDailyReward += 500;

      // Referral logic for referringUser if applicable
      if (referringUser) {
        if (!referringUser.refferalIds) {
            referringUser.refferalIds = []; // Initialize if undefined
        }
    
        referringUser.refferalIds.push({ userId: user._id });
    
        const referralReward = 10000; // Fixed reward for referring a user
        referringUser.totalRewards += referralReward;
        referringUser.balanceRewards += referralReward;
        referringUser.referRewards += referralReward;
    
        const numberOfReferrals = referringUser.refferalIds.length;
        let milestoneReward = 0;
    
        // Check for milestone rewards
        for (const milestone of milestones) {
            if (numberOfReferrals === milestone.referrals) {
                milestoneReward += milestone.reward;
            }
        }
    
        if (milestoneReward > 0) {
            referringUser.totalRewards += milestoneReward;
            referringUser.balanceRewards += milestoneReward;
            referringUser.referRewards += milestoneReward;
        }
    
        const twoXBooster = referringUser.boosters.find(
            booster => booster.type === '2x'
        );
        if (twoXBooster) {
            twoXBooster.count += 5;
        } else {
            referringUser.boosters.push({ type: '2x', count: 5 });
        }
    
        updateLevel(referringUser);
        await referringUser.save();
    
        // Update the reward points for the referring user in `userReward` model
        const referRewardRecord = await userReward.findOne({
            userId: referringUser._id,
            category: 'refer',
            date: today
        });
    
        if (referRewardRecord) {
            // Update the rewardPoints if a record exists for today
            referRewardRecord.rewardPoints += referralReward + milestoneReward;
            await referRewardRecord.save();
        } else {
            // Create a new record for today if none exists
            const newReward = new userReward({
                category: 'refer',
                date: today,
                rewardPoints: referralReward + milestoneReward,
                userId: referringUser._id,
                telegramId: referringUser.telegramId
            });
            await newReward.save();
        }
    
        // Reflect referral rewards in the `userDailyreward` model
        let referringUserDailyReward = await userDailyreward.findOne({
            userId: referringUser._id,
            createdAt: { $gte: today }
        });
    
        if (referringUserDailyReward) {
            referringUserDailyReward.dailyEarnedRewards += referralReward + milestoneReward;
            await referringUserDailyReward.save();
        } else {
            // Create a new daily reward record if none exists for today
            referringUserDailyReward = new userDailyreward({
                userId: referringUser._id,
                telegramId: referringUser.telegramId,
                dailyEarnedRewards: referralReward + milestoneReward,
                createdAt: today
            });
            await referringUserDailyReward.save();
        }
    }
    
    } else {
      // Existing user login logic
      const lastLoginDate = new Date(user.lastLogin);
      if (currentDate > lastLoginDate) {
        const levelUpBooster = user.boosters.find(
          booster => booster.type === 'levelUp'
        );

        if (levelUpBooster) {
          levelUpBooster.count += 1;
        } else {
          user.boosters.push({ type: 'levelUp', count: 1 });
        }
      }

      user.lastLogin = currentDate;
      await user.save();
    }

    // Update daily rewards in userDailyreward model
    let dailyReward = await userDailyreward.findOne({
      userId: user._id,
      createdAt: { $gte: today }
    });

    if (dailyReward) {
      dailyReward.dailyEarnedRewards += totalDailyReward;
      await dailyReward.save();
    } else {
      dailyReward = new userDailyreward({
        userId: user._id,
        telegramId: user.telegramId,
        dailyEarnedRewards: totalDailyReward,
        createdAt: today
      });
      await dailyReward.save();
    }

    updateLevel(user);

    res.status(201).json({
      message: 'User logged in successfully',
      user,
      currentPhase
    });
  } catch (err) {
    logger.error(
      `Error processing game rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    );
    next(err);
  }
};


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

    let dailyPoints = 0 // Track the rewards earned today

    // Update game points
    if (gamePoints) {
      const points = parseInt(gamePoints, 10)
      if (!isNaN(points) && points > 0) {
        user.gameRewards.gamePoints += points
        user.gameRewards.createdAt = now

        // Add gamePoints to totalRewards
        user.totalRewards += points
        user.balanceRewards += points

        dailyPoints += points

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

    // Update the userDailyreward model for the current day
    let dailyReward = await userDailyreward.findOne({
      userId: user._id,
      createdAt: { $gte: new Date(currentDateString) }
    })

    if (dailyReward) {
      // Update the existing record
      dailyReward.dailyEarnedRewards += dailyPoints
      await dailyReward.save()
      logger.info(
        `Updated userDailyreward for user ${telegramId} on ${currentDateString}`
      )
    } else {
      // Create a new daily reward record
      dailyReward = new userDailyreward({
        userId: user._id,
        telegramId,
        dailyEarnedRewards: dailyPoints,
        createdAt: now
      })
      await dailyReward.save()
      logger.info(
        `Created new userDailyreward for user ${telegramId} on ${currentDateString}`
      )
    }

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
    const { telegramId, taskPoints, channel } = req.body

    logger.info(
      `Received request to add task rewards for user with telegramId: ${telegramId}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const now = new Date() // Get current date and time
    const currentDateString = now.toISOString().split('T')[0] // "YYYY-MM-DD"

    // Ensure taskPoints is a Number
    const pointsToAdd = Number(taskPoints) || 0

    // Check if the specific channel is already true (rewards already claimed)
    if (channel && user.taskRewards.hasOwnProperty(channel)) {
      if (user.taskRewards[channel]) {
        logger.warn(
          `Rewards for ${channel} have already been claimed by user with telegramId: ${telegramId}`
        )
        return res.status(400).json({
          message: `Rewards for ${channel} have already been claimed.`
        })
      }
    } else {
      logger.warn(`Invalid channel: ${channel}`)
      return res.status(400).json({ message: 'Invalid channel provided.' })
    }

    // Add taskPoints to totalRewards and taskRewards
    if (pointsToAdd > 0) {
      user.totalRewards += pointsToAdd
      user.balanceRewards += pointsToAdd

      // Update taskPoints within taskRewards
      user.taskRewards.taskPoints += pointsToAdd

      // Set the specific channel to true
      user.taskRewards[channel] = true
      logger.info(
        `Updated ${channel} to true and added ${pointsToAdd} task points for user with telegramId: ${telegramId}`
      )

      // Check for an existing userReward record for today and category "task"
      let reward = await userReward.findOne({
        telegramId,
        date: currentDateString,
        category: 'task'
      })

      if (reward) {
        // Update the rewardPoints for today's record
        reward.rewardPoints += pointsToAdd
        await reward.save()
        logger.info(
          `Updated userReward for user ${telegramId} on ${currentDateString}`
        )
      } else {
        // Create a new userReward record for today
        reward = new userReward({
          category: 'task',
          date: currentDateString,
          rewardPoints: pointsToAdd,
          userId: user._id,
          telegramId
        })
        await reward.save()
        logger.info(
          `Created new userReward for user ${telegramId} on ${currentDateString}`
        )
      }

      // Update or create a userDailyreward record for today
      const dailyReward = await userDailyreward.findOne({
        telegramId,
        createdAt: {
          $gte: new Date(currentDateString),
          $lt: new Date(currentDateString + 'T23:59:59')
        }
      })

      if (dailyReward) {
        dailyReward.dailyEarnedRewards += pointsToAdd
        await dailyReward.save()
        logger.info(
          `Updated daily reward for user ${telegramId} on ${currentDateString}`
        )
      } else {
        await userDailyreward.create({
          userId: user._id,
          telegramId,
          dailyEarnedRewards: pointsToAdd
        })
        logger.info(
          `Created new daily reward for user ${telegramId} on ${currentDateString}`
        )
      }

      logger.info(`Added ${pointsToAdd} taskPoints to user ${telegramId}`)
    }

    // Update the user's level and levelUpRewards based on the new totalRewards
    updateLevel(user, currentDateString)

    // Save the updated user document
    await user.save()

    logger.info(
      `Successfully added taskPoints and updated channel for user with telegramId: ${telegramId}`
    )

    return res
      .status(200)
      .json({ message: 'TaskPoints added successfully', user })
  } catch (err) {
    logger.error(
      `Error processing task rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    )
    next(err)
  }
}

const purchaseBooster = async (req, res, next) => {
  try {
    const { telegramId, boosterPoints, booster, boosterCount } = req.body

    // Log the incoming request
    logger.info(
      `Received request to purchase booster for telegramId: ${telegramId}`
    )

    // Get the current date and time
    const now = new Date()

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    // Check if the user exists
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if the user has enough boosterPoints available in balanceRewards
    const totalBoosterPoints = parseInt(boosterPoints, 10)
    if (user.balanceRewards < totalBoosterPoints) {
      logger.warn(
        `Insufficient points for booster purchase for telegramId: ${telegramId}`
      )
      return res
        .status(400)
        .json({ message: 'Not enough purchase points available' })
    }

    // Deduct the total boosterPoints from balanceRewards
    user.balanceRewards -= totalBoosterPoints

    // Log the deduction of points
    logger.info(
      `Deducted ${totalBoosterPoints} points from balanceRewards for telegramId: ${telegramId}`
    )

    // Add the total boosterPoints to spendingRewards (positive value)
    user.spendingRewards += totalBoosterPoints

    // Log the addition in spendingRewards
    logger.info(
      `Added ${totalBoosterPoints} points to spendingRewards for telegramId: ${telegramId}`
    )

    // Check if the booster type exists in the boosters array
    const existingBooster = user.boosters.find(b => b.type === booster)

    if (existingBooster) {
      // If booster exists, update the count
      existingBooster.count += boosterCount
      logger.info(
        `Updated booster count for ${booster} to ${existingBooster.count} for telegramId: ${telegramId}`
      )
    } else {
      // If booster doesn't exist, add a new entry
      user.boosters.push({
        type: booster,
        count: boosterCount
      })
      logger.info(
        `Added new booster ${booster} with count ${boosterCount} for telegramId: ${telegramId}`
      )
    }

    // Create or update spending history in userReward model
    const currentDateString = now.toISOString().split('T')[0] // Get today's date in 'YYYY-MM-DD' format

    // Check for an existing userReward record for today and category "spending"
    let reward = await userReward.findOne({
      telegramId,
      date: currentDateString,
      category: 'spending'
    })

    if (reward) {
      // If a record exists, update the rewardPoints for today's record
      reward.rewardPoints += totalBoosterPoints
      await reward.save()
      logger.info(
        `Updated userReward for spending for user ${telegramId} on ${currentDateString}`
      )
    } else {
      // If no record exists, create a new userReward record for today's spending
      reward = new userReward({
        category: 'spending',
        date: currentDateString,
        rewardPoints: totalBoosterPoints, // Store positive value for spending
        userId: user._id,
        telegramId
      })
      await reward.save()
      logger.info(
        `Created new userReward for spending for user ${telegramId} on ${currentDateString}`
      )
    }

    // Save the updated user data
    await user.save()

    // Respond with the updated user details
    logger.info(`Booster purchase successful for telegramId: ${telegramId}`)
    return res.status(200).json({
      message: 'Booster purchased successfully',
      user
    })
  } catch (err) {
    logger.error(
      `Error processing booster purchase for telegramId: ${req.body.telegramId} - ${err.message}`
    )
    next(err)
  }
}

const purchaseGameCards = async (req, res, next) => {
  try {
    const { telegramId, gamePoints } = req.body

    // Get the current date and time
    const now = new Date()
    const currentDateString = now.toISOString().split('T')[0] // Today's date in YYYY-MM-DD format

    logger.info(
      `Received request to purchase game cards for user with telegramId: ${telegramId}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Ensure gamePoints is a valid number
    const pointsToDeduct = Number(gamePoints) || 0

    // Check if user has enough balanceRewards
    if (user.balanceRewards < pointsToDeduct) {
      logger.warn(
        `Insufficient points: User with telegramId ${telegramId} tried to deduct ${pointsToDeduct}, but only has ${user.balanceRewards}`
      )
      return res.status(400).json({
        message: 'Insufficient points'
      })
    }

    // Deduct points from balanceRewards and add to spendingRewards
    user.balanceRewards -= pointsToDeduct
    user.spendingRewards = (user.spendingRewards || 0) + pointsToDeduct
    await user.save()

    logger.info(
      `Deducted ${pointsToDeduct} points from balanceRewards and added to spendingRewards for user with telegramId: ${telegramId}.`
    )

    // Check for an existing userReward record for today and category "spending"
    let reward = await userReward.findOne({
      telegramId,
      date: currentDateString,
      category: 'spending'
    })

    if (reward) {
      // If a record exists, update the rewardPoints for today's record
      reward.rewardPoints += pointsToDeduct
      await reward.save()
      logger.info(
        `Updated userReward for spending for user ${telegramId} on ${currentDateString}`
      )
    } else {
      // If no record exists, create a new userReward record for today's spending
      reward = new userReward({
        category: 'spending',
        date: currentDateString,
        rewardPoints: pointsToDeduct, // Store positive value for spending
        userId: user._id,
        telegramId
      })
      await reward.save()
      logger.info(
        `Created new userReward record for spending for user ${telegramId} on ${currentDateString}`
      )
    }

    return res.status(200).json({
      message: 'Game card purchased successfully',
      user
    })
  } catch (err) {
    logger.error(
      `Error processing game card purchase for telegramId: ${req.body.telegramId} - ${err.message}`
    )
    next(err)
  }
}

const stakingRewards = async (req, res, next) => {
  try {
    const { stakingId } = req.body;

    // Validate stakingId
    if (!isValidObjectId(stakingId)) {
      logger.warn(`Invalid stakingId format: ${stakingId}`);
      return res.status(400).json({ message: 'Invalid stakingId format' });
    }

    // Find the userDailyreward record with the matching stakingId
    const userRewardRecord = await userDailyreward.findOne({ _id: stakingId });
    if (!userRewardRecord) {
      logger.warn(`UserDailyreward not found for stakingId: ${stakingId}`);
      return res.status(404).json({ message: 'UserDailyreward not found' });
    }

    // Check if user has already staked
    if (userRewardRecord.userStaking) {
      logger.info(`User has already staked for stakingId: ${stakingId}`);
      return res.status(400).json({ message: 'User has already staked' });
    }

    // Double the dailyEarnedRewards (e.g., 500 -> 1000)
    const doubledReward = userRewardRecord.dailyEarnedRewards * 2;
    userRewardRecord.dailyEarnedRewards = doubledReward; // Save the doubled value in the record
    userRewardRecord.userStaking = true;  // Mark the user as staked
    await userRewardRecord.save();

    // Find the user in the User model
    const user = await User.findOne({ _id: userRewardRecord.userId });
    if (!user) {
      logger.warn(`User not found in User model for userId: ${userRewardRecord.userId}`);
      return res.status(404).json({ message: 'User not found in User model' });
    }

    // Add the original dailyEarnedRewards (500) to totalRewards, balanceRewards, and stakingRewards
    user.totalRewards += userRewardRecord.dailyEarnedRewards / 2;    // Add original reward (500)
    user.balanceRewards += userRewardRecord.dailyEarnedRewards / 2;  // Add original reward (500)
    user.stakingRewards += userRewardRecord.dailyEarnedRewards / 2;  // Add original reward (500)



    // Create a new userReward record with category 'stake'
    await userReward.create({
      category: 'stake',
      date: new Date(),
      rewardPoints: userRewardRecord.dailyEarnedRewards / 2,  // Use the original reward (500) for userReward record
      userId: user._id,
      telegramId: user.telegramId,
    });

    updateLevel(user)
    await user.save();  // Save the updated user data

    logger.info(`Processed staking rewards for stakingId: ${stakingId}, added ${userRewardRecord.dailyEarnedRewards / 2} to user ${user._id}`);

    res.status(200).json({
      message: 'Staking rewards updated successfully',
      user,
    });
  } catch (err) {
    logger.error(`Error processing staking rewards for stakingId: ${req.body.stakingId} - ${err.message}`);
    next(err);
  }
};

module.exports = {
  login,
  userGameRewards,
  userTaskRewards,
  purchaseBooster,
  purchaseGameCards,
  stakingRewards
}
