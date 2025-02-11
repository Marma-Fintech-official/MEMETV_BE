const memeThresholds = [
  { memeIndexLimit: 0, level: 1 },
  { memeIndexLimit: 500, level: 2 },
  { memeIndexLimit: 1500, level: 3 },
  { memeIndexLimit: 3000, level: 4 },
  { memeIndexLimit: 5000, level: 5 },
  { memeIndexLimit: 7500, level: 6 }
]

const watchRewardsPerMeme = [
  500, // Level 1
  600, // Level 2
  700, // Level 3
  800, // Level 4
  900, // Level 5
  1000, // Level 6
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

const loginStreakReward = [100, 200, 400, 800, 1600, 3200, 6400]
const watchStreakReward = [100, 200, 400, 800, 1600, 3200, 6400]
const referStreakReward = [1000, 1500, 3000, 6000, 12000, 24000, 48000]
const taskStreakReward = [100, 200, 400, 800, 1600, 3200, 6400]
const multiStreakReward = [1300, 2100, 4200, 8400, 16800, 33600, 67200]

const distributionStartDate = new Date('2025-01-09')
const calculateDayDifference = async inputDate => {
  let currentDate = new Date()
  const currentDay = currentDate.toISOString().split('T')[0]
  currentDate = new Date(currentDay)
  let lastDay = inputDate.toISOString().split('T')[0]
  lastDay = new Date(lastDay)
  // Calculate the difference in milliseconds
  const differenceInTime = currentDate.getTime() - lastDay.getTime()
  // Convert the difference from milliseconds to days
  const differenceInDays = differenceInTime / (1000 * 3600 * 24)
  return differenceInDays
}
//function to check start date in a week
const checkStartDay = async user => {
  //will calculate day difference between curent date and distribution end
  const res = Math.abs(await calculateDayDifference(distributionStartDate)) + 1
  if (res % 7 == 0) {
    user.streak.startDay = 7
  } else if (res % 7 == 6) {
    user.streak.startDay = 6
  } else if (res % 7 == 5) {
    user.streak.startDay = 5
  } else if (res % 7 == 4) {
    user.streak.startDay = 4
  } else if (res % 7 == 3) {
    user.streak.startDay = 3
  } else if (res % 7 == 2) {
    user.streak.startDay = 2
  } else if (res % 7 == 1) {
    user.streak.startDay = 1
  }
  return user.streak.startDay
}
//function to set current day in a week
const setCurrentDay = async user => {
  //will calculate day difference between current date and distribution end
  const res = Math.abs(await calculateDayDifference(distributionStartDate)) + 1
  if (res % 7 == 0) {
    user.streak.currentDay = 7
  } else if (res % 7 == 6) {
    user.streak.currentDay = 6
  } else if (res % 7 == 5) {
    user.streak.currentDay = 5
  } else if (res % 7 == 4) {
    user.streak.currentDay = 4
  } else if (res % 7 == 3) {
    user.streak.currentDay = 3
  } else if (res % 7 == 2) {
    user.streak.currentDay = 2
  } else if (res % 7 == 1) {
    user.streak.currentDay = 1
  }
  return user.streak.currentDay
}

module.exports = {
  memeThresholds,
  watchRewardsPerMeme,
  milestones,
  loginStreakReward,
  watchStreakReward,
  referStreakReward,
  taskStreakReward,
  multiStreakReward,
  calculateDayDifference,
  checkStartDay,
  setCurrentDay,
  distributionStartDate
}
