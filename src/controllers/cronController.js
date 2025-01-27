const UserDailyReward = require('../models/userDailyrewardsModel');
const User = require('../models/userModel');
const logger = require('../helpers/logger');

const dailyRewardsForBlockChain = async (req, res, next) => {
  try {
    // Get the current date in ISO format
    const currentDate = new Date();

    // Convert currentDate to the start and end of the day
    const startOfDay = new Date(currentDate.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(currentDate.setUTCHours(23, 59, 59, 999));

    // Find all records from UserDailyReward for today's date
    const dailyRewards = await UserDailyReward.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).select('telegramId dailyEarnedRewards userStaking'); // Select necessary fields

    if (dailyRewards.length === 0) {
      return res.status(404).json({
        message: 'No daily rewards found for today.',
      });
    }

    // Function to calculate rewards from previous days
    const calculatePreviousRewards = async (telegramId, currentStartOfDay) => {
      let totalRewards = 0;
      let previousDate = new Date(currentStartOfDay);

      while (true) {
        // Move to the previous day
        previousDate.setDate(previousDate.getDate() - 1);
        const startOfPrevDay = new Date(previousDate.setUTCHours(0, 0, 0, 0));
        const endOfPrevDay = new Date(previousDate.setUTCHours(23, 59, 59, 999));

        // Find the reward for the previous day
        const prevReward = await UserDailyReward.findOne({
          telegramId,
          createdAt: { $gte: startOfPrevDay, $lte: endOfPrevDay },
        }).select('dailyEarnedRewards userStaking');

        if (!prevReward) {
          // Stop checking if no record is found
          break;
        }

        // Add rewards only if userStaking is false
        if (!prevReward.userStaking) {
          totalRewards += prevReward.dailyEarnedRewards;
        }
      }

      return totalRewards;
    };

    // Transform the data: handle userStaking logic and calculate previous rewards
    const transformedRewards = await Promise.all(
      dailyRewards.map(async (reward) => {
        const user = await User.findOne({ telegramId: reward.telegramId }).select('userWalletAddress');
        
        let totalRewards = 0;
        if (reward.userStaking) {
          // Today's userStaking is true, only add previous rewards
          totalRewards = await calculatePreviousRewards(reward.telegramId, startOfDay);
        } else {
          // Today's userStaking is false, include today's rewards and previous rewards
          const previousRewards = await calculatePreviousRewards(reward.telegramId, startOfDay);
          totalRewards = reward.dailyEarnedRewards + previousRewards;
        }

        return {
          telegramId: reward.telegramId,
          dailyEarnedRewards: totalRewards, // Include today's rewards (if applicable) and previous rewards
          userWalletAddress: user ? user.userWalletAddress : null, // Include wallet address or null if not found
        };
      })
    );

    // Send response with the transformed data
    res.status(200).json({
      message: 'Daily rewards Fetched Successfully.',
      data: transformedRewards,
    });
  } catch (err) {
    logger.error(`Error processing dailyRewardsForBlockChain - ${err.message}`);
    res.status(500).json({
      message: 'Something went wrong',
    });
    next(err);
  }
};






module.exports = {dailyRewardsForBlockChain}
