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
  { limit: 1000, level: 2 },
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
  let currentLevel = user.level || 1;
  let newLevel = currentLevel;
  let newLevelUpPoints = 0;

  // Loop through thresholds to determine new level
  for (const threshold of thresholds) {
    if (user.totalRewards >= threshold.limit) {
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
    user.levelUpRewards += newLevelUpPoints;
    user.level = newLevel;
  }

  // Only proceed if there are actual level-up points
  if (newLevelUpPoints > 0) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Reset time to midnight for today's date

    // Check if a level-up reward record already exists for today
    const levelUpRewardRecord = await userReward.findOne({
      userId: user._id,
      category: 'levelUp',
      date: today
    });

    if (levelUpRewardRecord) {
      // If a record exists for today, update the rewardPoints
      levelUpRewardRecord.rewardPoints += newLevelUpPoints;
      await levelUpRewardRecord.save();
    } else {
      // If no record exists, create a new record for today
      const newLevelUpReward = new userReward({
        category: 'levelUp',
        date: today,
        rewardPoints: newLevelUpPoints,
        userId: user._id,
        telegramId: user.telegramId
      });
      await newLevelUpReward.save();
    }
  } else {
    console.log('No level-up points to update.');
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

    // Extract current year, month, and day
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth();
    const currentDay = currentDate.getUTCDate();

    // Calculate the current phase
    const currentPhase = calculatePhase(currentDate, startDate);

    let referringUser = null;
    if (referredById) {
      referringUser = await User.findOne({ refId: referredById });

      if (!referringUser) {
        referredById = ''; // Reset if referring user is not found
        console.error('Referring user not found');
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
        levelUpRewards: 500,
      });

      await user.save();

      // Referral logic for referringUser if applicable
      if (referringUser) {
        if (!referringUser.yourReferenceIds) {
          referringUser.yourReferenceIds = []; // Initialize if undefined
        }

        referringUser.yourReferenceIds.push({ userId: user._id });

        referringUser.totalRewards += 10000;
        referringUser.referRewards += 10000;

        const numberOfReferrals = referringUser.yourReferenceIds.length;
        let milestoneReward = 0;

        // Check for milestone rewards
        for (const milestone of milestones) {
          if (numberOfReferrals === milestone.referrals) {
            milestoneReward += milestone.reward;
          }
        }

        if (milestoneReward > 0) {
          referringUser.totalRewards += milestoneReward;
          referringUser.referRewards += milestoneReward;
        }

        const twoXBooster = referringUser.boosters.find(
          (booster) => booster.type === '2x'
        );
        if (twoXBooster) {
          twoXBooster.count += 5;
        } else {
          referringUser.boosters.push({ type: '2x', count: 5 });
        }

        updateLevel(referringUser);
        await referringUser.save();

        // Update the reward points for the referring user
        const referRewardRecord = await userReward.findOne({
          userId: referringUser._id,
          category: 'refer',
          date: today,
        });

        if (referRewardRecord) {
          // If a record exists for today, update the rewardPoints
          referRewardRecord.rewardPoints += 10000 + milestoneReward;
          await referRewardRecord.save();
        } else {
          // If no record exists, create a new record for today
          const newReward = new userReward({
            category: 'refer',
            date: today,
            rewardPoints: 10000 + milestoneReward,
            userId: referringUser._id,
            telegramId: referringUser.telegramId,
          });
          await newReward.save();
        }
      }
    } else {
      // Existing user login logic
      const lastLoginDate = new Date(user.lastLogin);
      const lastLoginDay = lastLoginDate.getUTCDate();
      const lastLoginMonth = lastLoginDate.getUTCMonth();
      const lastLoginYear = lastLoginDate.getUTCFullYear();

      if (
        currentYear > lastLoginYear ||
        currentMonth > lastLoginMonth ||
        currentDay > lastLoginDay
      ) {
        const levelUpBooster = user.boosters.find(
          (booster) => booster.type === 'levelUp'
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

    // Update the levelUp rewards in userReward model
    const levelUpRewardRecord = await userReward.findOne({
      userId: user._id,
      category: 'levelUp',
      date: today,
    });

    if (levelUpRewardRecord) {
      // If a record exists for today, update the rewardPoints
      levelUpRewardRecord.rewardPoints += 500; // Adding default rewardPoints (500) if not already present
      await levelUpRewardRecord.save();
    } else {
      // If no record exists, create a new record for today with default rewardPoints
      const newReward = new userReward({
        category: 'levelUp',
        date: today,
        rewardPoints: 500, // Default rewardPoints
        userId: user._id,
        telegramId: user.telegramId,
      });
      await newReward.save();
    }

    updateLevel(user);

    res.status(201).json({
      message: `User logged in successfully`,
      user,
      currentPhase,
    });
  } catch (err) {
    logger.error(
      `Error processing task rewards for user with telegramId: ${req.body.telegramId} - ${err.message}`
    );
    next(err);
  }
};

module.exports = {
  login
}
