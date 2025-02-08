const User = require('../models/userModel');
const logger = require('../helpers/logger');
const userReward = require('../models/userRewardModel');
const userDailyreward = require('../models/userDailyrewardsModel');
const mongoose = require('mongoose');
const { isValidObjectId } = mongoose;
const {
  milestones,
} = require('../helpers/constants');
const { decryptedDatas } = require('../helpers/Decrypt');
const {
  calculateLoginStreak,
  calculateTaskStreak,
} = require('../controllers/userStreakController');
const {
  calculateDayDifference,
  distributionStartDate,
} = require('../helpers/constants');

const TOTALREWARDS_LIMIT = 21000000000;
const fs = require('fs');
const path = require('path');

// Function to generate a 5-character alphanumeric identifier
const generateRefId = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
};

const startDate = new Date('2025-01-09'); // Project start date

const calculatePhase = (currentDate, startDate) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const daysDifference = Math.floor((currentDate - startDate) / oneDay);
  const phase = Math.floor(daysDifference / 7) + 1;
  return Math.min(phase);
};


const login = async (req, res, next) => {
  try {

    let { name, referredById, telegramId, superUser } = req.body
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

    // Load userData.json
    const userDataPath = path.join(
      __dirname,
      '../earlyEarnedrewards/userData.json'
    );
    let userData = [];

    if (fs.existsSync(userDataPath)) {
      userData = JSON.parse(fs.readFileSync(userDataPath, 'utf8'));
    }
    // Find user in userData.json
    const userInData = userData.find((u) => u.telegramId === telegramId);
    const extraRewards = userInData ? userInData.balanceRewards : 0;

    if (!user) {
      // Before creating a new user, check if the rewards limit is exceeded
      const totalRewardsInSystem = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balanceRewards' } } },
      ]);

      const totalRewardsUsed = totalRewardsInSystem[0]
        ? totalRewardsInSystem[0].total
        : 0;
      const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed;

      if (availableSpace <= 0) {
        return res.status(403).json({
          message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`,
        });
      }

      // New user registration logic
      user = new User({
        name,
        telegramId,
        refId,
        referredById,
        totalRewards: (superUser ? 10000 : 0) + extraRewards,
        balanceRewards: (superUser ? 10000 : 0) + extraRewards,
        earlyEarnedRewards: extraRewards,
        referRewards: 0,
        boosters: [{ type: 'levelUp', count: 1 }], // Initialize booster here for new users
        lastLogin: currentDate,
        level: 1,
        levelUpRewards: superUser ? 10000 : 0, // Apply the change here
      });

      if (
        (await calculateDayDifference(
          user.streak.loginStreak.loginStreakDate
        )) != 0 ||
        user.streak.loginStreak.loginStreakCount == 0
      ) {
        const lastLoginTime = user.lastLogin;
        let currentDate = new Date();
        const currentDay = currentDate.toISOString().split('T')[0];
        currentDate = new Date(currentDay);
        // Calculate the difference in milliseconds
        const differenceInTime = Math.abs(
          currentDate.getTime() - distributionStartDate.getTime()
        );
        // Convert the difference from milliseconds to days
        const differenceInDays =
          Math.floor(differenceInTime / (1000 * 3600 * 24)) - 1;
        const login = await calculateLoginStreak(
          user,
          lastLoginTime,
          differenceInDays
        );
        logger.info(
          `Login Streak reward claimed successfully for user ${telegramId}`
        );
        await user.save();
      } else {
        logger.info(
          `Login Streak reward already claimed for user ${telegramId}`
        );
      }

      await user.save();

      if (superUser) {
        const newLevelUpReward = new userReward({
          category: 'superUser',
          date: today,
          rewardPoints: 10000, // Only saves if superUser is true
          userId: user._id,
          telegramId: user.telegramId,
        });
        await newLevelUpReward.save();
      }

      totalDailyReward = superUser ? 10000 : 0 + extraRewards;

      // Referral logic for referringUser if applicable
      if (referringUser) {
        if (!referringUser.refferalIds) {
          referringUser.refferalIds = []; // Initialize if undefined
        }

        referringUser.refferalIds.push({ userId: user._id });

        const referralReward = 10000; // Fixed reward for referring a user
        const numberOfReferrals = referringUser.refferalIds.length;

        let milestoneReward = 0;

        // Check for milestone rewards
        for (const milestone of milestones) {
          if (numberOfReferrals === milestone.referrals) {
            milestoneReward += milestone.reward;
          }
        }

        const totalPotentialReward =
          referringUser.balanceRewards + referralReward + milestoneReward;

        if (totalPotentialReward > TOTALREWARDS_LIMIT) {
          const remainingRewardSpace =
            TOTALREWARDS_LIMIT - referringUser.balanceRewards;

          if (remainingRewardSpace > 0) {
            const proportionalReferralReward = Math.min(
              referralReward,
              remainingRewardSpace
            );
            const remainingAfterReferral =
              remainingRewardSpace - proportionalReferralReward;

            const proportionalMilestoneReward = Math.min(
              milestoneReward,
              remainingAfterReferral
            );

            // Add only the feasible rewards
            referringUser.totalRewards +=
              proportionalReferralReward + proportionalMilestoneReward;
            referringUser.balanceRewards +=
              proportionalReferralReward + proportionalMilestoneReward;
            referringUser.referRewards +=
              proportionalReferralReward + proportionalMilestoneReward;

            // Save the rewards
            const referRewardRecord = await userReward.findOne({
              userId: referringUser._id,
              category: 'refer',
              date: today,
            });

            if (referRewardRecord) {
              referRewardRecord.rewardPoints +=
                proportionalReferralReward + proportionalMilestoneReward;
              await referRewardRecord.save();
            } else {
              const newReward = new userReward({
                category: 'refer',
                date: today,
                rewardPoints:
                  proportionalReferralReward + proportionalMilestoneReward,
                userId: referringUser._id,
                telegramId: referringUser.telegramId,
              });
              await newReward.save();
            }

            let referringUserDailyReward = await userDailyreward.findOne({
              userId: referringUser._id,
              createdAt: { $gte: today },
            });

            if (referringUserDailyReward) {
              referringUserDailyReward.dailyEarnedRewards +=
                proportionalReferralReward + proportionalMilestoneReward;
              await referringUserDailyReward.save();
            } else {
              referringUserDailyReward = new userDailyreward({
                userId: referringUser._id,
                telegramId: referringUser.telegramId,
                dailyEarnedRewards:
                  proportionalReferralReward + proportionalMilestoneReward,
                createdAt: today,
              });
              await referringUserDailyReward.save();
            }

            const twoXBooster = referringUser.boosters.find(
              (booster) => booster.type === '2x'
            );
            if (twoXBooster) {
              twoXBooster.count += 5;
            } else {
              referringUser.boosters.push({ type: '2x', count: 5 });
            }
          } else {
            console.warn(
              `User ${referringUser.name} has reached the total rewards limit of ${TOTALREWARDS_LIMIT}. No additional rewards granted.`
            );
          }
        } else {
          referringUser.totalRewards += referralReward + milestoneReward;
          referringUser.balanceRewards += referralReward + milestoneReward;
          referringUser.referRewards += referralReward + milestoneReward;

          const referRewardRecord = await userReward.findOne({
            userId: referringUser._id,
            category: 'refer',
            date: today,
          });

          if (referRewardRecord) {
            referRewardRecord.rewardPoints += referralReward + milestoneReward;
            await referRewardRecord.save();
          } else {
            const newReward = new userReward({
              category: 'refer',
              date: today,
              rewardPoints: referralReward + milestoneReward,
              userId: referringUser._id,
              telegramId: referringUser.telegramId,
            });
            await newReward.save();
          }

          let referringUserDailyReward = await userDailyreward.findOne({
            userId: referringUser._id,
            createdAt: { $gte: today },
          });

          if (referringUserDailyReward) {
            referringUserDailyReward.dailyEarnedRewards +=
              referralReward + milestoneReward;
            await referringUserDailyReward.save();
          } else {
            referringUserDailyReward = new userDailyreward({
              userId: referringUser._id,
              telegramId: referringUser.telegramId,
              dailyEarnedRewards: referralReward + milestoneReward,
              createdAt: today,
            });
            await referringUserDailyReward.save();
          }

          const twoXBooster = referringUser.boosters.find(
            (booster) => booster.type === '2x'
          );
          if (twoXBooster) {
            twoXBooster.count += 5;
          } else {
            referringUser.boosters.push({ type: '2x', count: 5 });
          }
        }

        await referringUser.save();
      }
    } else {
      // Existing user login logic
      const lastLoginDate = new Date(user.lastLogin);

      if (lastLoginDate < today) {
        // Add a level-up booster only once per day
        const levelUpBooster = user.boosters.find(
          (booster) => booster.type === 'levelUp'
        );

        if (levelUpBooster) {
          levelUpBooster.count += 1;
        } else {
          user.boosters.push({ type: 'levelUp', count: 1 });
        }

        user.lastLogin = currentDate;
        await user.save();
      }
    }
    // Update daily rewards in userDailyreward model
    let dailyReward = await userDailyreward.findOne({
      userId: user._id,
      createdAt: { $gte: today },
    });

    if (dailyReward) {
      dailyReward.dailyEarnedRewards += totalDailyReward;
      await dailyReward.save();
    } else {
      dailyReward = new userDailyreward({
        userId: user._id,
        telegramId: user.telegramId,
        dailyEarnedRewards: totalDailyReward,
        createdAt: today,
      });
      await dailyReward.save();
    }

    //login streak calculation logic
    if (
      (await calculateDayDifference(user.streak.loginStreak.loginStreakDate)) !=
        0 ||
      user.streak.loginStreak.loginStreakCount == 0
    ) {
      const lastLoginTime = user.lastLogin;
      let currentDate = new Date();
      const currentDay = currentDate.toISOString().split('T')[0];
      currentDate = new Date(currentDay);
      // Calculate the difference in milliseconds
      const differenceInTime = Math.abs(
        currentDate.getTime() - distributionStartDate.getTime()
      );
      // Convert the difference from milliseconds to days
      const differenceInDays =
        Math.floor(differenceInTime / (1000 * 3600 * 24)) - 1;
      // console.log(user, login, differenceInDays,"user, login, differenceInDaysuser, login, differenceInDaysuser, login, differenceInDays");
      const login = await calculateLoginStreak(
        user,
        lastLoginTime,
        differenceInDays
      );
      logger.info(
        `Login Streak reward claimed successfully for user ${telegramId}`
      );
      await user.save();
    } else {
      logger.info(`Login Streak reward already claimed for user ${telegramId}`);
    }

    res.status(201).json({
      message: 'User logged in successfully',
      user,
      currentPhase,
    });
  } catch (err) {
    logger.error(
      `Error processing login for telegramId: ${req.body.telegramId} - ${err.message}`
    );

    // Respond with a generic message
    res.status(500).json({
      message: 'Something went wrong',
    });

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
};

const userGameRewards = async (req, res, next) => {
  try {
    // const { telegramId, boosters, gamePoints } = decryptedDatas(req);
    const { telegramId, boosters, gamePoints } = req.body

    const now = new Date();
    const currentDateString = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    logger.info(
      `Received request to add game rewards for user with telegramId: ${telegramId}`
    );

    const user = await User.findOne({ telegramId });

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.gameRewards && user.gameRewards.createdAt) {
      const lastUpdateDate = new Date(user.gameRewards.createdAt);
      const lastUpdateDateString = lastUpdateDate.toISOString().split('T')[0];

      if (currentDateString < lastUpdateDateString) {
        logger.warn(
          `Attempt to update game rewards to an earlier date for user ${telegramId}`
        );
        return res.status(403).json({
          message: `Game Rewards cannot be updated to an earlier date.`,
          user,
        });
      }
    }

    // Calculate the available space for totalRewards across all users
    const totalRewardsInSystem = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balanceRewards' } } },
    ]);

    //calculates how much space is available for rewards in the system-wide
    const totalRewardsUsed = totalRewardsInSystem[0]
      ? totalRewardsInSystem[0].total
      : 0;
    const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed;

    if (availableSpace <= 0) {
      logger.warn(
        `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
      );
      return res.status(403).json({
        message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`,
      });
    }

    let dailyPoints = 0; // Track the rewards earned today

    if (gamePoints) {
      const points = parseInt(gamePoints);
      if (!isNaN(points) && points > 0) {
        // Calculate the allowable points to add to this user's balance
        const userAvailableSpace = TOTALREWARDS_LIMIT - user.balanceRewards;
        const allowedPoints = Math.min(
          points,
          userAvailableSpace,
          availableSpace
        );

        if (allowedPoints > 0) {
          user.gameRewards.gamePoints += allowedPoints;
          user.gameRewards.createdAt = now;

          user.totalRewards += allowedPoints;
          user.balanceRewards += allowedPoints;

          dailyPoints += allowedPoints;

          let reward = await userReward.findOne({
            telegramId,
            date: currentDateString,
            category: 'game',
          });

          if (reward) {
            reward.rewardPoints += allowedPoints;
            await reward.save();
            logger.info(
              `Updated userReward for user ${telegramId} on ${currentDateString}`
            );
          } else {
            reward = new userReward({
              category: 'game',
              date: currentDateString,
              rewardPoints: allowedPoints,
              userId: user._id,
              telegramId,
            });
            await reward.save();
            logger.info(
              `Created new userReward for user ${telegramId} on ${currentDateString}`
            );
          }

          logger.info(
            `Added ${allowedPoints} gamePoints to user ${telegramId}`
          );
        } else {
          logger.warn(
            `No points could be added for user ${telegramId} due to reward limits.`
          );
        }

        if (points > allowedPoints) {
          logger.warn(
            `Only ${allowedPoints} out of ${points} gamePoints were added for user ${telegramId}.`
          );
        }
      } else {
        logger.warn(`Invalid gamePoints value: ${gamePoints}`);
      }
    }

    // Update boosters (unchanged logic)
    if (Array.isArray(boosters) && boosters.length > 0) {
      const boosterCounts = boosters.reduce((acc, booster) => {
        acc[booster] = (acc[booster] || 0) + 1;
        return acc;
      }, {});

      user.boosters = user.boosters.map((booster) => {
        if (boosterCounts[booster.type]) {
          booster.count += boosterCounts[booster.type];
          delete boosterCounts[booster.type];
        }
        return booster;
      });

      for (const [type, count] of Object.entries(boosterCounts)) {
        user.boosters.push({ type, count });
      }

      logger.info(`Updated boosters for user ${telegramId}`);
    }

    let dailyReward = await userDailyreward.findOne({
      userId: user._id,
      createdAt: { $gte: new Date(currentDateString) },
    });

    if (dailyReward) {
      dailyReward.dailyEarnedRewards += dailyPoints;
      await dailyReward.save();
      logger.info(
        `Updated userDailyreward for user ${telegramId} on ${currentDateString}`
      );
    } else {
      dailyReward = new userDailyreward({
        userId: user._id,
        telegramId,
        dailyEarnedRewards: dailyPoints,
        createdAt: now,
      });
      await dailyReward.save();
      logger.info(
        `Created new userDailyreward for user ${telegramId} on ${currentDateString}`
      );
    }
    if (
      (await calculateDayDifference(user.streak.loginStreak.loginStreakDate)) ==
      0
    ) {
      let currentDate = new Date();
      const currentDay = currentDate.toISOString().split('T')[0];
      currentDate = new Date(currentDay);
      // Calculate the difference in milliseconds
      const differenceInTime = Math.abs(
        currentDate.getTime() - distributionStartDate.getTime()
      );
      // Convert the difference from milliseconds to days
      const differenceInDays =
        Math.floor(differenceInTime / (1000 * 3600 * 24)) - 1;
      // Calculate streaks
      const login =
        (await calculateDayDifference(
          user.streak.loginStreak.loginStreakDate
        )) == 0;
      // console.log(user, login, differenceInDays,"user, login, differenceInDaysuser, login, differenceInDaysuser, login, differenceInDays");
      const game = await calculateTaskStreak(user, login, differenceInDays);
      logger.info(
        `Game Streak reward claimed successfully for user ${telegramId}`
      );
    } else {
      logger.info(`Game Streak reward already claimed for user ${telegramId}`);
    }

    await user.save();
    logger.info(`Successfully updated game rewards for user ${telegramId}`);

    return res.status(200).json({
      message: 'Game rewards updated successfully',
      user,
    });
  } catch (err) {
    logger.error(
      `Error processing game rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    );
    res.status(500).json({
      message: 'Something went wrong',
    });

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
};

const userTaskRewards = async (req, res, next) => {
  try {
    // const { telegramId, taskPoints, channel } = decryptedDatas(req);

    const { telegramId, taskPoints, channel } = req.body

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

    // Calculate the available space for totalRewards across all users
    const totalRewardsInSystem = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balanceRewards' } } },
    ]);

    //calculates how much space is available for rewards in the system-wide
    const totalRewardsUsed = totalRewardsInSystem[0]
      ? totalRewardsInSystem[0].total
      : 0;
    const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed;

    if (availableSpace <= 0) {
      logger.warn(
        `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
      );
      return res.status(403).json({
        message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`,
      });
    }

    // Calculate allowable points to add
    const userAvailableSpace = TOTALREWARDS_LIMIT - user.balanceRewards;
    const allowedPoints = Math.min(
      pointsToAdd,
      userAvailableSpace,
      availableSpace
    );

    if (allowedPoints > 0) {
      user.totalRewards += allowedPoints;
      user.balanceRewards += allowedPoints;

      // Update taskPoints within taskRewards
      user.taskRewards.taskPoints += allowedPoints;

      // Set the specific channel to true
      user.taskRewards[channel] = true;
      logger.info(
        `Updated ${channel} to true and added ${allowedPoints} task points for user with telegramId: ${telegramId}`
      );

      // Check for an existing userReward record for today and category "task"
      let reward = await userReward.findOne({
        telegramId,
        date: currentDateString,
        category: 'task',
      });

      if (reward) {
        // Update the rewardPoints for today's record
        reward.rewardPoints += allowedPoints;
        await reward.save();
        logger.info(
          `Updated userReward for user ${telegramId} on ${currentDateString}`
        );
      } else {
        // Create a new userReward record for today
        reward = new userReward({
          category: 'task',
          date: currentDateString,
          rewardPoints: allowedPoints,
          userId: user._id,
          telegramId,
        });
        await reward.save();
        logger.info(
          `Created new userReward for user ${telegramId} on ${currentDateString}`
        );
      }

      // Update or create a userDailyreward record for today
      const dailyReward = await userDailyreward.findOne({
        telegramId,
        createdAt: {
          $gte: new Date(currentDateString),
          $lt: new Date(currentDateString + 'T23:59:59'),
        },
      });

      if (dailyReward) {
        dailyReward.dailyEarnedRewards += allowedPoints;
        await dailyReward.save();
        logger.info(
          `Updated daily reward for user ${telegramId} on ${currentDateString}`
        );
      } else {
        dailyReward = new userDailyreward({
          userId: user._id,
          telegramId,
          dailyEarnedRewards: allowedPoints,
        });
        await dailyReward.save();

        logger.info(
          `Created new daily reward for user ${telegramId} on ${currentDateString}`
        );
      }

      logger.info(`Added ${allowedPoints} taskPoints to user ${telegramId}`);
    } else {
      logger.warn(
        `No points could be added for user ${telegramId} due to reward limits.`
      );
    }

    if (pointsToAdd > allowedPoints) {
      logger.warn(
        `Only ${allowedPoints} out of ${pointsToAdd} task points were added for user ${telegramId}.`
      );
    }

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
    res.status(500).json({
      message: 'Something went wrong',
    });

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
};

const purchaseBooster = async (req, res, next) => {
  try {
    const { telegramId, boosterPoints, booster, boosterCount } =
      decryptedDatas(req);

    logger.info(
      `Received request to purchase booster for telegramId: ${telegramId}`
    );

    const now = new Date();

    const user = await User.findOne({ telegramId });

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    const totalBoosterPoints = parseInt(boosterPoints);
    if (user.balanceRewards < totalBoosterPoints) {
      logger.warn(
        `Insufficient points for booster purchase for telegramId: ${telegramId}`
      );
      return res
        .status(400)
        .json({ message: 'Not enough purchase points available' });
    }

    user.balanceRewards -= totalBoosterPoints;
    logger.info(
      `Deducted ${totalBoosterPoints} points from balanceRewards for telegramId: ${telegramId}`
    );

    user.spendingRewards += totalBoosterPoints;
    logger.info(
      `Added ${totalBoosterPoints} points to spendingRewards for telegramId: ${telegramId}`
    );

    const existingBooster = user.boosters.find((b) => b.type === booster);

    if (existingBooster) {
      existingBooster.count += boosterCount;
      logger.info(
        `Updated booster count for ${booster} to ${existingBooster.count} for telegramId: ${telegramId}`
      );
    } else {
      user.boosters.push({ type: booster, count: boosterCount });
      logger.info(
        `Added new booster ${booster} with count ${boosterCount} for telegramId: ${telegramId}`
      );
    }

    const currentDateString = now.toISOString().split('T')[0];

    let reward = await userReward.findOne({
      telegramId,
      date: currentDateString,
      category: 'spending',
    });

    if (reward) {
      reward.rewardPoints += totalBoosterPoints;
      await reward.save();
      logger.info(
        `Updated userReward for spending for user ${telegramId} on ${currentDateString}`
      );
    } else {
      reward = new userReward({
        category: 'spending',
        date: currentDateString,
        rewardPoints: totalBoosterPoints,
        userId: user._id,
        telegramId,
      });
      await reward.save();
      logger.info(
        `Created new userReward for spending for user ${telegramId} on ${currentDateString}`
      );
    }

    const todayDailyRewardRecord = await userDailyreward.findOne({
      telegramId,
      createdAt: {
        $gte: new Date(`${currentDateString}T00:00:00.000Z`),
        $lt: new Date(`${currentDateString}T23:59:59.999Z`),
      },
    });

    if (todayDailyRewardRecord) {
      let remainingBoosterPoints = totalBoosterPoints; // Use a mutable variable

      if (todayDailyRewardRecord.dailyEarnedRewards >= remainingBoosterPoints) {
        todayDailyRewardRecord.dailyEarnedRewards -= remainingBoosterPoints;
      } else {
        remainingBoosterPoints -= todayDailyRewardRecord.dailyEarnedRewards;
        todayDailyRewardRecord.dailyEarnedRewards = 0;
      }

      await todayDailyRewardRecord.save();
      logger.info(
        `Updated dailyEarnedRewards for telegramId: ${telegramId}. Remaining rewards: ${todayDailyRewardRecord.dailyEarnedRewards}`
      );
    } else {
      logger.warn(
        `No daily rewards record found for today's date for telegramId: ${telegramId}`
      );
      return res
        .status(400)
        .json({ message: 'No daily rewards available for today' });
    }

    await user.save();

    logger.info(`Booster purchase successful for telegramId: ${telegramId}`);
    return res.status(200).json({
      message: 'Booster purchased successfully',
      user,
    });
  } catch (err) {
    logger.error(
      `Error processing booster purchase for telegramId: ${req.body.telegramId} - ${err.message}`
    );
    res.status(500).json({
      message: 'Something went wrong',
    });

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
};

const purchaseGameCards = async (req, res, next) => {
  try {
    const { telegramId, gamePoints } = decryptedDatas(req);

    // Get the current date and time
    const now = new Date();
    const currentDateString = now.toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format

    logger.info(
      `Received request to purchase game cards for user with telegramId: ${telegramId}`
    );

    // Find the user by telegramId
    const user = await User.findOne({ telegramId });

    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure gamePoints is a valid number
    const pointsToDeduct = Number(gamePoints) || 0;

    // Check if user has enough balanceRewards
    if (user.balanceRewards < pointsToDeduct) {
      logger.warn(
        `Insufficient points: User with telegramId ${telegramId} tried to deduct ${pointsToDeduct}, but only has ${user.balanceRewards}`
      );
      return res.status(400).json({
        message: 'Insufficient points',
      });
    }

    // Deduct points from balanceRewards and add to spendingRewards
    user.balanceRewards -= pointsToDeduct;
    user.spendingRewards = (user.spendingRewards || 0) + pointsToDeduct;
    await user.save();

    logger.info(
      `Deducted ${pointsToDeduct} points from balanceRewards and added to spendingRewards for user with telegramId: ${telegramId}.`
    );

    // Check for an existing userReward record for today and category "spending"
    let reward = await userReward.findOne({
      telegramId,
      date: currentDateString,
      category: 'spending',
    });

    if (reward) {
      // If a record exists, update the rewardPoints for today's record
      reward.rewardPoints += pointsToDeduct;
      await reward.save();
      logger.info(
        `Updated userReward for spending for user ${telegramId} on ${currentDateString}`
      );
    } else {
      // If no record exists, create a new userReward record for today's spending
      reward = new userReward({
        category: 'spending',
        date: currentDateString,
        rewardPoints: pointsToDeduct, // Store positive value for spending
        userId: user._id,
        telegramId,
      });
      await reward.save();
      logger.info(
        `Created new userReward record for spending for user ${telegramId} on ${currentDateString}`
      );
    }

    const todayDailyRewardRecord = await userDailyreward.findOne({
      telegramId,
      createdAt: {
        $gte: new Date(`${currentDateString}T00:00:00.000Z`),
        $lt: new Date(`${currentDateString}T23:59:59.999Z`),
      },
    });

    if (todayDailyRewardRecord) {
      let remainingGamePoints = pointsToDeduct; // Use a mutable variable

      if (todayDailyRewardRecord.dailyEarnedRewards >= remainingGamePoints) {
        todayDailyRewardRecord.dailyEarnedRewards -= remainingGamePoints;
      } else {
        remainingGamePoints -= todayDailyRewardRecord.dailyEarnedRewards;
        todayDailyRewardRecord.dailyEarnedRewards = 0;
      }

      await todayDailyRewardRecord.save();
      logger.info(
        `Updated dailyEarnedRewards for telegramId: ${telegramId}. Remaining rewards: ${todayDailyRewardRecord.dailyEarnedRewards}`
      );
    } else {
      logger.warn(
        `No daily rewards record found for today's date for telegramId: ${telegramId}`
      );
      return res
        .status(400)
        .json({ message: 'No daily rewards available for today' });
    }

    return res.status(200).json({
      message: 'Game card purchased successfully',
      user,
    });
  } catch (err) {
    logger.error(
      `Error processing game card purchase for telegramId: ${req.body.telegramId} - ${err.message}`
    );
    res.status(500).json({
      message: 'Something went wrong',
    });

    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
};

const stakingRewards = async (req, res, next) => {
  try {
    // const { stakingId } = decryptedDatas(req);
    const { stakingId } = req.body;

    if (!isValidObjectId(stakingId)) {
      logger.warn(`Invalid stakingId format: ${stakingId}`);
      return res.status(400).json({ message: 'Invalid stakingId format' });
    }

    const userRewardRecord = await userDailyreward.findOne({ _id: stakingId });

    if (!userRewardRecord) {
      logger.warn(`UserDailyreward not found for stakingId: ${stakingId}`);
      return res.status(404).json({ message: 'UserDailyreward not found' });
    }

    if (userRewardRecord.userStaking) {
      logger.info(`User has already staked for stakingId: ${stakingId}`);
      return res.status(400).json({ message: 'User has already staked' });
    }

    const totalRewardsInSystem = await userDailyreward.aggregate([
      { $group: { _id: null, total: { $sum: '$dailyEarnedRewards' } } },
    ]);
    const totalRewardsUsed = totalRewardsInSystem[0] ? totalRewardsInSystem[0].total : 0;
    const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed;
    const originalReward = userRewardRecord.dailyEarnedRewards;
    const rewardToAllocate = Math.min(originalReward, availableSpace);

    userRewardRecord.dailyEarnedRewards += rewardToAllocate;
    userRewardRecord.userStaking = true;
    await userRewardRecord.save();

    const user = await User.findOne({ _id: userRewardRecord.userId });
    if (!user) {
      logger.warn(`User not found in User model for userId: ${userRewardRecord.userId}`);
      return res.status(404).json({ message: 'User not found in User model' });
    }

    user.totalRewards += rewardToAllocate;
    user.balanceRewards += rewardToAllocate;
    user.stakingRewards += rewardToAllocate;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existingStakeRecord = await userReward.findOne({
      userId: user._id,
      category: 'stake',
      date: { $gte: todayStart, $lte: todayEnd },
    });

    if (existingStakeRecord) {
      // Update existing record instead of creating a new one
      existingStakeRecord.rewardPoints += rewardToAllocate;
      await existingStakeRecord.save();
    } else {
      // Create new record if not exists for today
      await userReward.create({
        category: 'stake',
        date: new Date(),
        rewardPoints: rewardToAllocate,
        userId: user._id,
        telegramId: user.telegramId,
      });
    }

    await user.save();

    logger.info(`Processed staking rewards for stakingId: ${stakingId}, added ${rewardToAllocate} to user ${user._id}`);

    res.status(200).json({
      message: 'Staking rewards updated successfully',
      user,
    });
  } catch (err) {
    logger.error(`Error processing staking rewards for stakingId: ${req.body.stakingId} - ${err.message}`);
    res.status(500).json({ message: 'Something went wrong' });
    next(err);
  }
};


const getMintedTokens = async (req, res, next) => {
  try {
    // Aggregate all users' balanceRewards
    const totalMintedTokens = await User.aggregate([
      {
        $group: {
          _id: null, // Group all documents
          totalBalanceRewards: { $sum: '$balanceRewards' }, // Sum the balanceRewards field
        },
      },
    ]);

    // Extract the total balanceRewards
    const total =
      totalMintedTokens.length > 0
        ? totalMintedTokens[0].totalBalanceRewards
        : 0;

    // Respond with the total minted tokens
    res.status(200).json({
      totalMintedTokens: total,
    });
  } catch (err) {
    // Log the error
    logger.error(`Error processing Minted Tokens - ${err.message}`);

    // Send error response
    res.status(500).json({
      message: 'Something went wrong',
    });

    // Pass the error to the next middleware
    next(err);
  }
};

module.exports = {
  login,
  userGameRewards,
  userTaskRewards,
  purchaseBooster,
  purchaseGameCards,
  stakingRewards,
  getMintedTokens,
};
