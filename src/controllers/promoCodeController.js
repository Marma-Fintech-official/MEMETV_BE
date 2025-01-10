const fs = require('fs');
const User = require('../models/userModel'); // Adjust the path as necessary
const UserDailyReward = require('../models/userDailyrewardsModel');
const UserReward = require('../models/userRewardModel');

// Update or create daily earned rewards
const updateDailyEarnedRewards = async (userId, telegramId, reward) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    // Find or create a daily reward record for today
    let dailyReward = await UserDailyReward.findOne({
      userId,
      telegramId,
      createdAt: { $gte: new Date(today) },
    });

    if (dailyReward) {
      // Update the existing daily reward
      dailyReward.dailyEarnedRewards += reward;
      dailyReward.updatedAt = new Date();
    } else {
      // Create a new record if none exists for today
      dailyReward = new UserDailyReward({
        userId,
        telegramId,
        dailyEarnedRewards: reward,
        createdAt: new Date(),
      });
    }

    await dailyReward.save(); // Save the record

    console.log(
      dailyReward.dailyEarnedRewards === reward
        ? `New daily reward record created for ${telegramId}.`
        : `Daily rewards updated for ${telegramId}: ${reward} added.`
    );
  } catch (error) {
    console.error(
      `Error updating daily rewards for user ${telegramId}: ${error.message}`
    );
  }
};

const savePromoReward = async (user, rewardPoints) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

    // Create a new reward document for every redemption
    const rewardRecord = new UserReward({
      category: 'promo', // Category as promo
      date: new Date(today), // Set today's date
      rewardPoints: rewardPoints, // Set reward points
      userId: user._id, // Set userId
      telegramId: user.telegramId, // Set telegramId
    });

    // Save the new reward record
    await rewardRecord.save();
    console.log(
      `New reward record created for user ${user.telegramId} with ${rewardPoints} points.`
    );
  } catch (error) {
    console.error(`Error saving promo reward: ${error.message}`);
  }
};


// const savePromoReward = async (user, rewardPoints) => {
//   try {
//     const today = new Date().toISOString().split('T')[0] // Get today's date in YYYY-MM-DD format

//     // Find an existing reward record for the same day
//     let rewardRecord = await UserReward.findOne({
//       userId: user._id,
//       category: 'promo',
//       date: new Date(today)
//     })

//     if (rewardRecord) {
//       // Update the existing record
//       rewardRecord.rewardPoints =
//         (rewardRecord.rewardPoints || 0) + rewardPoints // Add the new reward points
//       rewardRecord.updatedAt = new Date() // Update the timestamp
//     } else {
//       // Create a new record if none exists
//       rewardRecord = new UserReward({
//         category: 'promo',
//         date: new Date(today), // Set today's date
//         rewardPoints: rewardPoints, // Set reward points
//         userId: user._id, // Set userId
//         telegramId: user.telegramId // Set telegramId
//       })
//     }

//     await rewardRecord.save() // Save the record to the database
//     console.log(
//       `Reward record updated for user ${user.telegramId} with ${rewardPoints} points.`
//     )
//   } catch (error) {
//     console.error(`Error saving streak reward: ${error.message}`)
//   }
// }

// Load promo codes from file
const promoCodes = JSON.parse(fs.readFileSync('./src/PromoCodes/promoCodes.json', 'utf-8'));

const validatePromocode = async (req, res) => {
  const { telegramId, promoCode } = req.body;

  if (!telegramId || !promoCode) {
    return res.status(400).json({ message: 'Telegram ID and promo code are required.' });
  }

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if the promo code is valid
    const validPromo = promoCodes.find((p) => p.promoCode === promoCode);
    if (!validPromo) {
      return res.status(400).json({ message: 'Invalid promo code.' });
    }
    if (validPromo.status) {
      return res.status(400).json({ message: 'Promo code already used.' });
    }

    // Update user rewards
    user.balanceRewards += validPromo.reward;
    user.promoRewards += validPromo.reward;
    user.totalRewards += validPromo.reward;
    user.usedPromoCodes = user.usedPromoCodes || [];
    user.usedPromoCodes.push(promoCode);

    // Update daily earned rewards
    await updateDailyEarnedRewards(user._id, telegramId, validPromo.reward);
    await savePromoReward(user, validPromo.reward);


    // Mark promo code as used
    validPromo.status = true;
    fs.writeFileSync('./src/PromoCodes/promoCodes.json', JSON.stringify(promoCodes, null, 2));

    // Save the updated user
    await user.save();

    return res.status(200).json({
      message: 'Promo code validated and reward added.',
      balanceRewards: user.balanceRewards,
      totalRewards: user.totalRewards,
      promoReward: validPromo.reward,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { validatePromocode };
