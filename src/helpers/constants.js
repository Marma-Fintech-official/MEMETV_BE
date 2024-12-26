// Level-up bonuses for each level
const levelUpBonuses = [
  20, // Level 2 to Level 3
  10000, // Level 3 to Level 4
  50000, // Level 4 to Level 5
  100000, // Level 5 to Level 6
  500000, // Level 6 to Level 7
  1000000, // Level 7 to Level 8
  5000000, // Level 8 to Level 9
  10000000, // Level 9 to Level 10
  20000000 // Level 10 and above
]

// Thresholds for level-ups based on totalRewards
const thresholds = [
  { limit: 0, rewardPerSecond: 1, level: 1 },
  { limit: 700, rewardPerSecond: 2, level: 2 },
  { limit: 50000, rewardPerSecond: 3, level: 3 },
  { limit: 200000, rewardPerSecond: 4, level: 4 },
  { limit: 800000, rewardPerSecond: 5, level: 5 },
  { limit: 3000000, rewardPerSecond: 6, level: 6 },
  { limit: 10000000, rewardPerSecond: 7, level: 7 },
  { limit: 25000000, rewardPerSecond: 8, level: 8 },
  { limit: 50000000, rewardPerSecond: 9, level: 9 },
  { limit: 80000000, rewardPerSecond: 10, level: 10 }
]

// Milestones for referrals and associated rewards
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

module.exports = {
  levelUpBonuses,
  thresholds,
  milestones
}
