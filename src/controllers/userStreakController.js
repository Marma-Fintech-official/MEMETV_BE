const User = require('../models/userModel')
const logger = require('../helpers/logger')
const UserReward = require('../models/userRewardModel')
const userDailyreward = require("../models/userDailyrewardsModel")
const {
  loginStreakReward,
  watchStreakReward,
  referStreakReward,
  taskStreakReward,
  multiStreakReward,
  calculateDayDifference,
  checkStartDay,
  setCurrentDay,
  distributionStartDate,
} = require('../helpers/constants');
const {decryptedDatas} = require('../helpers/Decrypt');
const UserDailyReward = require('../models/userDailyrewardsModel'); // Import the model
require('dotenv').config()
const TOTALREWARDS_LIMIT = 21000000000;

const saveStreakReward = async (user, rewardPoints) => {
  try {
    const today = new Date().toISOString().split('T')[0] // Get today's date in YYYY-MM-DD format

    // Find an existing reward record for the same day
    let rewardRecord = await UserReward.findOne({
      userId: user._id,
      category: 'streak',
      date: new Date(today)
    })

    if (rewardRecord) {
      // Update the existing record
      rewardRecord.rewardPoints =
        (rewardRecord.rewardPoints || 0) + rewardPoints // Add the new reward points
      rewardRecord.updatedAt = new Date() // Update the timestamp
    } else {
      // Create a new record if none exists
      rewardRecord = new UserReward({
        category: 'streak',
        date: new Date(today), // Set today's date
        rewardPoints: rewardPoints, // Set reward points
        userId: user._id, // Set userId
        telegramId: user.telegramId // Set telegramId
      })
    }

    await rewardRecord.save() // Save the record to the database
    console.log(
      `Reward record updated for user ${user.telegramId} with ${rewardPoints} points.`
    )
  } catch (error) {
    console.error(`Error saving streak reward: ${error.message}`)
  }
}

const updateDailyEarnedRewards = async (userId, telegramId, reward) => {
  try {
    const today = new Date().toISOString().split('T')[0] // Get today's date in YYYY-MM-DD format

    // Find or create a daily reward record for today
    let dailyReward = await UserDailyReward.findOne({
      userId,
      telegramId,
      createdAt: { $gte: new Date(today) }
    })

    if (dailyReward) {
      // Update the existing daily reward
      dailyReward.dailyEarnedRewards += reward
      dailyReward.updatedAt = new Date()
    } else {
      // Create a new record if none exists for today
      dailyReward = new UserDailyReward({
        userId,
        telegramId,
        dailyEarnedRewards: rewardAmount,
        createdAt: new Date()
      })
    }

    await dailyReward.save() // Save the record
    console.log(
      `Daily rewards updated for user ${telegramId}: ${reward} added.`
    )
  } catch (error) {
    console.error(
      `Error updating daily rewards for user ${telegramId}: ${error.message}`
    )
  }
}

const addOrUpdateBooster = (user, boosterType, count) => {
  const existingBooster = user.boosters.find(
    booster => booster.type === boosterType
  )
  if (existingBooster) {
    existingBooster.count += count
  } else {
    user.boosters.push({ type: boosterType, count })
  }
}

const updateBoosterForStreak = (user, streakType, count) => {
  const boosterType = `${streakType}x` // e.g., "3x", "5x", "10x"
  addOrUpdateBooster(user, boosterType, count)
}

//function to check the start date and not update it
const rewardAmountcheckStartDayWatchReferTaskMulti = async (user)=>{
  //will calculate day difference between curent date and distribution end
  const res = Math.abs(await calculateDayDifference(distributionStartDate))+1;
  if(res%7==0){
    return 7;
  }
  else if(res%7==6){
    return 6;
  }
  else if(res%7==5){
    return 5;
  }
  else if(res%7==4){
    return 4;
  }
  else if(res%7==3){
    return 3;
  }
  else if(res%7==2){
    return 2;
  }
  else if(res%7==1){
    return 1;
  }
}

//function to reset the streak
const resetStreak = (user, streakType) => {
  const streak = user.streak[streakType];
  // Move rewards to unclaimed
  for (let i = 0; i < streak[`${streakType}Reward`].length; i++) {
    streak[`unClaimed${capitalizeFirstLetter(streakType)}Reward`] += streak[`${streakType}Reward`][i];
    streak[`${streakType}Reward`][i] = 0;
    streak[`${streakType}RewardUnclaimed`][i] = 0;
  }
  const match = streakType.match(/^[^A-Z]*/);
  // Reset claimed days to false
  user.streak[`claimed${capitalizeFirstLetter(match[0])}Days`] = new Array(7).fill(false);
};


//function to calculate the reward amount
const updateStreakReward = (user, streakType, streakRewardList, index) => {
  const streak = user.streak[streakType];

  // Check if the streak data exists and the count is valid
  if (streak && streak[`${streakType}Count`] > 0) {
    const countIndex = streak[`${streakType}Count`] - 1; // Get the correct index
    const rewardAmount = streakRewardList[countIndex];
    for(let i=0;i<index;i++){
      if(streak[`${streakType}Reward`][i]===undefined){
        streak[`${streakType}Reward`][i]=0;
        streak[`${streakType}RewardUnclaimed`][i] = 0;
      }
    }
    // Assign the reward amount to the corresponding streak reward
    streak[`${streakType}Reward`][index] = rewardAmount;
    // Assign the reward amount to the corresponding unclaimed streak reward array
    streak[`${streakType}RewardUnclaimed`][index] = rewardAmount;
  } else {
    console.error(`Invalid streak data for type: ${streakType}`);
  }
};


const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);



const calculateLoginStreak = async (user, lastLoginDate, differenceInDays) => {
  const currentDate = new Date()
  const currentDay = currentDate.getUTCDate()
  const lastLoginDay = lastLoginDate.getUTCDate()

  if (lastLoginDay != currentDay) {
    return false
  }
  if (
    (await calculateDayDifference(user.streak.loginStreak.loginStreakDate)) >=
      1 ||
    user.streak.loginStreak.loginStreakCount == 0
  ) {
    await setCurrentDay(user)
    if(user.streak.loginStreak.loginStreakCount == 0) await checkStartDay(user);
    if (
      user.streak.loginStreak.loginStreakCount === 7 ||
      (differenceInDays % 7) + 1 === 7
    ) {
      user.streak.loginStreak.loginStreakCount = 1
      user.streak.loginStreak.loginStreakDate = new Date()
      const startDay = await checkStartDay(user)
      // Reset all streaks
      const streakTypes = ['loginStreak', 'watchStreak', 'referStreak', 'taskStreak', 'multiStreak'];
      for (let i = 0; i < streakTypes.length; i++) {
        const streakType = streakTypes[i];
        resetStreak(user, streakType);
      }
      //function to claim the unclaimed rewards
      unClaimedStreakRewardsClaim(user)
    } else if (
      (await calculateDayDifference(user.streak.loginStreak.loginStreakDate)) >
      1
    ) {
      const loginDayDifference = await calculateDayDifference(
        user.streak.loginStreak.loginStreakDate
      )
      
      user.streak.loginStreak.loginStreakCount = 1

      const startDay = await checkStartDay(user)
      
      const loginStreakDayDifference = await calculateDayDifference(
        user.streak.loginStreak.loginStreakDate
      )

      user.streak.loginStreak.loginStreakDate = new Date()
      for (i = 0; i < user.streak.loginStreak.loginStreakReward.length; i++) {
        user.streak.loginStreak.unClaimedLoginStreakReward +=
          user.streak.loginStreak.loginStreakReward[i]
        user.streak.loginStreak.loginStreakReward[i] = 0
      }

      for (i = 0; i < user.streak.watchStreak.watchStreakReward.length; i++) {
        user.streak.watchStreak.unClaimedWatchStreakReward +=
          user.streak.watchStreak.watchStreakReward[i]
        user.streak.watchStreak.watchStreakReward[i] = 0
      }

      for (
        i = 0;
        i < user.streak.referStreak.referStreakReward.length;
        i++
      ) {
        user.streak.referStreak.unClaimedReferStreakReward +=
          user.streak.referStreak.referStreakReward[i]
        user.streak.referStreak.referStreakReward[i] = 0
      }

      for (i = 0; i < user.streak.taskStreak.taskStreakReward.length; i++) {
        user.streak.taskStreak.unClaimedTaskStreakReward +=
          user.streak.taskStreak.taskStreakReward[i]
        user.streak.taskStreak.taskStreakReward[i] = 0
      }

      unClaimedStreakRewardsClaim(user)
    } else {
      user.streak.loginStreak.loginStreakCount++
      user.streak.loginStreak.loginStreakDate = new Date()
    }
    //add rewards to login streak rewards
    const nthDay = (await calculateDayDifference(
      distributionStartDate
    )%7)
    
    updateStreakReward(user, "loginStreak", loginStreakReward, nthDay);
    updateBoosterForStreak(user, '3', user.streak.loginStreak.loginStreakCount)

    return true
  } else {
    if (lastLoginDay == currentDay) {
      return true
    } else {
      return false
    }
  }
}

const calculateWatchStreak = async (
  user,
  userWatchSeconds,
  todaysLogin,
  differenceInDays
) => {
  // check a user has logged in today
  if (todaysLogin) {
    //user watch seconds should be greater than 3 minutes for watch streak
    const currentDate = new Date()
    const currentDay = currentDate.getUTCDate()
    const lastWatchStreakDate =
      user.streak.watchStreak.watchStreakDate.getUTCDate()
    // if login day is different it'll come inside the condition
    if (
      lastWatchStreakDate != currentDay ||
      user.streak.watchStreak.watchStreakCount == 0
    ) {
      if (
        (user.streak.watchStreak.watchStreakCount === 7 ||
          (differenceInDays % 7) + 1 === 7) &&
        userWatchSeconds >= 180
      ) {
        user.streak.watchStreak.watchStreakCount = 1
        user.streak.watchStreak.watchStreakDate = new Date()
        resetStreak(user, "watchStreak");
        unClaimedStreakRewardsClaim(user)
      } else if (
        (await calculateDayDifference(
          user.streak.watchStreak.watchStreakDate
        )) > 1 &&
        userWatchSeconds >= 180
      ) {
        const watchDayDifference = await calculateDayDifference(
          user.streak.watchStreak.watchStreakDate
        )
        
        for (i = 0; i < watchDayDifference-1; i++) {
          if (((differenceInDays + i) % 7) + 1 === 7) {
            unClaimedStreakRewardsClaim(user)
          }
        }
        user.streak.watchStreak.watchStreakCount = 1
        const startDay = await rewardAmountcheckStartDayWatchReferTaskMulti(user)
        const watchStreakDayDifference = await calculateDayDifference(
          user.streak.watchStreak.watchStreakDate
        )
        
        user.streak.watchStreak.watchStreakDate = new Date()

      } else if (userWatchSeconds >= 180) {
        user.streak.watchStreak.watchStreakCount++
        user.streak.watchStreak.watchStreakDate = new Date()
      }

      if(await calculateDayDifference(
        user.streak.watchStreak.watchStreakDate
      )===0){
        const nthDay = (await calculateDayDifference(
          distributionStartDate
        )%7)
        updateStreakReward(user, "watchStreak", watchStreakReward, nthDay);
        updateBoosterForStreak(
          user,
          '3',
          user.streak.watchStreak.watchStreakCount
        )
      }
      return true
    } else {
      // same day login and no WATCH STREAK reward will be claimed
      return true
    }
  } else {
    return false
  }
}

const calculateReferStreak = async (user, todaysLogin, differenceInDays) => {
  // check a user has logged in today
  if (todaysLogin) {
    //array of referred people
    const refUsers = user.refferalIds
    let lastRefDay = 0
    if (refUsers.length == 0) {
      lastRefDay = 0
    } else {
      const lastRefUser = refUsers[refUsers.length - 1]
      lastRefDay = lastRefUser.createdAt.getUTCDate()
    }
    let isOnReferStreak = false
    const currentDate = new Date()
    const currentDay = currentDate.getUTCDate()

    // in the same day user has referred someone
    if (lastRefDay == currentDay) {
      // for loop to check a user has already maintained a refer streak
      for (i = refUsers.length - 1; i >= 0; i--) {
        let refDay = refUsers[i].createdAt
        if (refDay.getUTCDate() == lastRefDay) {
          continue
        } else if ((await calculateDayDifference(refDay)) == 1) {
          isOnReferStreak = true
          break
        } else {
          break
        }
      }
      const lastReferStreakDate =
        user.streak.referStreak.referStreakDate.getUTCDate()
      if (
        lastReferStreakDate != currentDay ||
        user.streak.referStreak.referStreakCount == 0
      ) {
        if (
          (isOnReferStreak && user.streak.referStreak.referStreakCount === 7) ||
          (differenceInDays % 7) + 1 === 7
        ) {
          user.streak.referStreak.referStreakCount = 1
          user.streak.referStreak.referStreakDate = new Date()
          resetStreak(user, "referStreak");
          unClaimedStreakRewardsClaim(user)
        } else if (isOnReferStreak) {
          user.streak.referStreak.referStreakCount++
          user.streak.referStreak.referStreakDate = new Date()
        } else {
          const referDayDifference = await calculateDayDifference(
            user.streak.referStreak.referStreakDate
          )
          for (i = 0; i < referDayDifference; i++) {
            if (((differenceInDays + i) % 7) + 1 === 7) {
              unClaimedStreakRewardsClaim(user)
            }
          }
          user.streak.referStreak.referStreakCount = 1
          const startDay = await rewardAmountcheckStartDayWatchReferTaskMulti(user)
          const referStreakDayDifference = await calculateDayDifference(
            user.streak.referStreak.referStreakDate
          )
          user.streak.referStreak.referStreakDate = new Date()
          
        }
        if(await calculateDayDifference(
          user.streak.referStreak.referStreakDate
        )===0){
          const nthDay = (await calculateDayDifference(
            distributionStartDate
          )%7)
          updateStreakReward(user, "referStreak", referStreakReward, nthDay);
          updateBoosterForStreak(
            user,
            '3',
            user.streak.referStreak.referStreakCount
          )
        }
        return true
      } else {
        // same day referring and no REFER STREAK reward will be claimed
        return true
      }
    } else {
      return false
    }
  } else {
    return false
  }
}

const calculateTaskStreak = async (user, todaysLogin, differenceInDays) => {
  // check a user has logged in today
  console.log("Inisde Task StreakInisde Task StreakInisde Task StreakInisde Task StreakInisde Task StreakInisde Task StreakInisde Task Streak");
  if (todaysLogin) {
    const currentDate = new Date()
    const currentDay = currentDate.getUTCDate()
    const lastGameDay = user.gameRewards.createdAt.toISOString().split('T')[0]
    const lastTaskStreakDay = user.streak.taskStreak.taskStreakDate.getUTCDate()
    if (
      lastGameDay == '1970-01-01' ||
      lastGameDay != currentDate.toISOString().split('T')[0]
    ) {
      return false
    }
    if (
      lastTaskStreakDay != currentDay ||
      user.streak.taskStreak.taskStreakCount == 0
    ) {
      if (
        user.streak.taskStreak.taskStreakCount === 7 ||
        (differenceInDays % 7) + 1 === 7
      ) {
        user.streak.taskStreak.taskStreakCount = 1
        user.streak.taskStreak.taskStreakDate = new Date()
        resetStreak(user, "taskStreak");
        unClaimedStreakRewardsClaim(user)
      } else if (
        (await calculateDayDifference(user.streak.taskStreak.taskStreakDate)) >
        1
      ) {
        const taskDayDifference = await calculateDayDifference(
          user.streak.taskStreak.taskStreakDate
        )
        for (i = 0; i < taskDayDifference; i++) {
          if (((differenceInDays + i) % 7) + 1 === 7) {
            unClaimedStreakRewardsClaim(user)
          }
        }
        user.streak.taskStreak.taskStreakCount = 1
        const startDay = await rewardAmountcheckStartDayWatchReferTaskMulti(user)
        const taskStreakDayDifference = await calculateDayDifference(
          user.streak.taskStreak.taskStreakDate
        )
        user.streak.taskStreak.taskStreakDate = new Date()
        
      } else {
        user.streak.taskStreak.taskStreakCount++
        user.streak.taskStreak.taskStreakDate = new Date()
      }
      if(await calculateDayDifference(
        user.streak.taskStreak.taskStreakDate
      )===0){
        const nthDay = (await calculateDayDifference(
          distributionStartDate
        )%7)
        updateStreakReward(user, "taskStreak", taskStreakReward, nthDay);
        updateBoosterForStreak(user, '3', user.streak.taskStreak.taskStreakCount)
      }
      return true
    } else {
      // same day playing and no TASK STREAK reward will be claimed
      return true
    }
  } else {
    return false
  }
}

//function to calculate streaks(login, watch, refer, task)
const streak = async (req, res, next) => {
  try {
    const { telegramId, userWatchSeconds } = decryptedDatas(req);
    // const { telegramId, userWatchSeconds } = req.body;

    // Log the incoming request
    logger.info(
      `Attempting to update streak rewards for telegramId: ${telegramId}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const lastLoginTime = user.lastLogin
    let currentDate = new Date()
    const currentDay = currentDate.toISOString().split('T')[0]
    currentDate = new Date(currentDay)

    if (currentDate < distributionStartDate) {
      logger.warn(
        `Distribution period has not started for telegramId for telegramId: ${telegramId}`
      )
      return res.status(400).json({ message: 'Distribution Not Started' })
    }

    // Calculate the difference in milliseconds
    const differenceInTime = Math.abs(
      currentDate.getTime() - distributionStartDate.getTime()
    )
    
    
    // Convert the difference from milliseconds to days
    const differenceInDays =
      Math.floor(differenceInTime / (1000 * 3600 * 24)) - 1
    // Calculate streaks
    // const login = await calculateLoginStreak(
    //   user,
    //   lastLoginTime,
    //   differenceInDays
    // )
    const login = await calculateDayDifference(user.streak.loginStreak.loginStreakDate)==0
    const watch = await calculateWatchStreak(
      user,
      userWatchSeconds,
      login,
      differenceInDays
    )
    const refer = await calculateReferStreak(user, login, differenceInDays)
    const task = await calculateDayDifference(user.streak.taskStreak.taskStreakDate)==0

    await user.save()

    logger.info(
      `Streak rewards updated successfully for telegramId: ${telegramId}`
    )

    res.status(200).json({
      message: 'Streak rewards updated successfully',
      name: user.name,
      telegramId: user.telegramId,
      loginStreak: user.streak.loginStreak,
      watchStreak: user.streak.watchStreak,
      referStreak: user.streak.referStreak,
      taskStreak: user.streak.taskStreak,
      login,
      watch,
      refer,
      task
    })
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown'
    logger.error(
      `Error while claiming Login Streak Reward for telegramId: ${telegramId}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
    next(err)
  }
}

const calculateMultiStreak = async (user, todaysLogin, differenceInDays) => {
  if (todaysLogin) {
    if (
      (await calculateDayDifference(user.streak.multiStreak.multiStreakDate)) !=
        0 ||
      user.streak.multiStreak.multiStreakCount == 0
    ) {
      if (
        (await calculateDayDifference(
          user.streak.multiStreak.multiStreakDate
        )) > 1
      ) {
        const multiDayDifference = await calculateDayDifference(
          user.streak.multiStreak.multiStreakDate
        )
        for (i = 0; i < multiDayDifference; i++) {
          if (((differenceInDays + i) % 7) + 1 === 7) {
            unClaimedStreakRewardsClaim(user)
          }
        }
        user.streak.multiStreak.multiStreakCount = 1
        const startDay = await rewardAmountcheckStartDayWatchReferTaskMulti(user)
        const multiStreakDayDifference = await calculateDayDifference(
          user.streak.multiStreak.multiStreakDate
        )
        user.streak.multiStreak.multiStreakDate = new Date()
        // for (i = 0; i < user.streak.multiStreak.multiStreakReward.length; i++) {
        //   user.streak.multiStreak.unClaimedMultiStreakReward +=
        //     user.streak.multiStreak.multiStreakReward[i]
        //   user.streak.multiStreak.multiStreakReward[i] = 0
        // }
        user.streak.multiStreak.streakOfStreakCount = 1
        user.streak.multiStreak.lastSOSReward = 0
      } else if (
        user.streak.multiStreak.multiStreakCount == 7 ||
        (differenceInDays % 7) + 1 === 7
      ) {
        for (i = 0; i < user.streak.multiStreak.multiStreakReward.length; i++) {
          user.streak.multiStreak.unClaimedMultiStreakReward +=
            user.streak.multiStreak.multiStreakReward[i]
          user.streak.multiStreak.multiStreakReward[i] = 0
        }
        user.streak.multiStreak.streakOfStreakCount++
        user.streak.multiStreak.multiStreakCount = 1
        user.streak.multiStreak.multiStreakDate = new Date()
        unClaimedStreakRewardsClaim(user)
      } else {
        user.streak.multiStreak.multiStreakCount++
        user.streak.multiStreak.streakOfStreakCount++
        user.streak.multiStreak.multiStreakDate = new Date()
      }
      
      const nthDay = (await calculateDayDifference(
        distributionStartDate
      )%7)
      
      updateStreakReward(user, "multiStreak", multiStreakReward, nthDay);
      updateBoosterForStreak(
        user,
        '5',
        user.streak.multiStreak.multiStreakCount
      )
      const rewardAmount =
        multiStreakReward[user.streak.multiStreak.multiStreakCount - 1]
      //add rewards to multi streak rewards
      // user.streak.multiStreak.multiStreakReward[
      //   user.streak.multiStreak.multiStreakCount - 1
      // ] = rewardAmount
      // SOS reward calculation
      if (user.streak.multiStreak.streakOfStreakCount > 1) {
        if (
          user.streak.multiStreak.streakOfStreakRewards[
            user.streak.multiStreak.streakOfStreakRewards.length - 1
          ] != 0
        ) {
          const previousSOSRewards =
            user.streak.multiStreak.streakOfStreakRewards.length == 0
              ? 0
              : user.streak.multiStreak.streakOfStreakRewards[
                  user.streak.multiStreak.streakOfStreakRewards.length - 1
                ]
          user.streak.multiStreak.streakOfStreakRewards.push(
            previousSOSRewards + rewardAmount
          )
        } else {
          user.streak.multiStreak.streakOfStreakRewards.push(
            user.streak.multiStreak.lastSOSReward + rewardAmount
          )
        }
      } else if (user.streak.multiStreak.streakOfStreakCount == 1) {
        for (
          i = 0;
          i < user.streak.multiStreak.streakOfStreakRewards.length;
          i++
        ) {
          user.streak.multiStreak.unClaimedStreakOfStreakRewards =
            Number(user.streak.multiStreak.unClaimedStreakOfStreakRewards) +
            Number(user.streak.multiStreak.streakOfStreakRewards[i])
          user.streak.multiStreak.streakOfStreakRewards[i] = 0
        }
        unClaimedStreakRewardsClaim(user)
      }
      return true
    } else {
      return true
    }
  }
}

//function to calculate streak of streaks(multi and sos)
const streakOfStreak = async (req, res, next) => {
  try {
    const { telegramId } = decryptedDatas(req);
    // const { telegramId } = req.body;

    // Log the incoming request
    logger.info(
      `Attempting to update Streak of Streak rewards for telegramId: ${telegramId}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const lastLoginTime = user.lastLogin
    let currentDate = new Date()
    const currentDay = currentDate.toISOString().split('T')[0]
    currentDate = new Date(currentDay)

    if (currentDate < distributionStartDate) {
      logger.warn(
        `Distribution period is not started for telegramId: ${telegramId}`
      )
      return res
        .status(400)
        .json({ message: 'Distribution period is not started' })
    }

    // Calculate the difference in milliseconds
    const differenceInTime = Math.abs(
      currentDate.getTime() - distributionStartDate.getTime()
    )
    // Convert the difference from milliseconds to days
    const differenceInDays =
      Math.floor(differenceInTime / (1000 * 3600 * 24)) - 1

    const todaysLogin =
      user.streak.loginStreak.loginStreakDate.toISOString().split('T')[0] ===
        currentDay && user.streak.loginStreak.loginStreakCount !== 0
    const todaysWatch =
      user.streak.watchStreak.watchStreakDate.toISOString().split('T')[0] ===
        currentDay && user.streak.watchStreak.watchStreakCount !== 0
    const todaysRefer =
      user.streak.referStreak.referStreakDate.toISOString().split('T')[0] ===
        currentDay && user.streak.referStreak.referStreakCount !== 0
    const todaysTask =
      user.streak.taskStreak.taskStreakDate.toISOString().split('T')[0] ===
        currentDay && user.streak.taskStreak.taskStreakCount !== 0

    if (todaysLogin && todaysWatch && todaysRefer && todaysTask) {
      const multiStreak = await calculateMultiStreak(
        user,
        todaysLogin,
        differenceInDays
      )

      await user.save()
      logger.info(
        `Streak of Streak rewards updated successfully for telegramId: ${telegramId}`
      )

      res.status(200).json({
        message: 'Streak of Streak rewards updated successfully',
        name: user.name,
        telegramId: user.telegramId,
        streakOfStreak: user.streak.multiStreak
      })
    } else {
      await user.save()
      logger.warn(
        `User has not completed all streaks for telegramId: ${telegramId}`
      )
      res.status(400).json({ message: 'User has not completed all streaks' })
    }
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown'
    logger.error(
      `Error while updating Streak of Streak rewards for telegramId: ${telegramId}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
    next(err)
  }
}

const loginStreakRewardClaim = async (req, res, next) => {
  try {
    
    const { telegramId, index } = decryptedDatas(req);
    // const { telegramId, index } = req.body

    logger.info(
      `Attempting to claim Login Streak Reward for telegramId: ${telegramId}, index: ${index}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const currentDate = new Date()

    // Check if the reward is valid
    if (
      user.streak.loginStreak.loginStreakReward.length > 0 &&
      user.streak.loginStreak.loginStreakReward[index] !== 0
    ) {
      const rewardAmount = user.streak.loginStreak.loginStreakReward[index]

      // Validate reward amount
      if (rewardAmount <= 0) {
        logger.warn(
          `No Login Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
        )
        return res.status(400).json({ message: 'No rewards to claim.' })
      }

      // Calculate the available space for total rewards globally
      const totalRewardsInSystem = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
      ])
      const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
      const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

      if (availableSpace <= 0) {
        logger.warn(
          `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
        )
        return res.status(403).json({
          message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
        })
      }

      // Calculate the points user can claim without exceeding limits
      const allowedPoints = Math.min(rewardAmount, availableSpace)

      // Update user rewards
      user.totalRewards += allowedPoints
      user.streakRewards += allowedPoints
      user.balanceRewards += allowedPoints

      // Update or partially update the claimed reward
      user.streak.loginStreak.loginStreakReward[index] -= allowedPoints

      await user.save()

      // Save reward record and update daily rewards
      await saveStreakReward(user, allowedPoints)
      await updateDailyEarnedRewards(user._id, telegramId, allowedPoints);

      
      logger.info(
        `Login Streak Reward claimed successfully for telegramId: ${telegramId}`
      )
      return res.status(200).json({
        message: `Login Streak Rewards claimed successfully. Claimed: ${allowedPoints}`,
        claimedReward: allowedPoints,
        remainingReward: rewardAmount - allowedPoints,
        loginStreak: user.streak.loginStreak,
        totalRewards: user.totalRewards,
        balanceRewards: user.balanceRewards
      })
    } else {
      logger.warn(
        `No Login Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
      )
      res
        .status(400)
        .json({ message: 'User has no Login Streak rewards to claim' })
    }
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown'
    logger.error(
      `Error while claiming Login Streak Reward for telegramId: ${telegramId}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
  
    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
}

const watchStreakRewardClaim = async (req, res, next) => {
  try {
    const { telegramId, index } = decryptedDatas(req);
    // const { telegramId, index } = req.body;

    // Log the incoming request
    logger.info(
      `Attempting to claim Watch Streak Reward for telegramId: ${telegramId}, index: ${index}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const currentDate = new Date()

    if (
      user.streak.watchStreak.watchStreakReward.length > 0 &&
      user.streak.watchStreak.watchStreakReward[index] != 0
    ) {
      const rewardAmount = user.streak.watchStreak.watchStreakReward[index]

      if (rewardAmount <= 0) {
        logger.warn(
          `No Watch Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
        )
        return res.status(400).json({ message: 'No rewards to claim.' })
      }
      // Calculate the available space for total rewards globally
      const totalRewardsInSystem = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
      ])
      const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
      const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

      if (availableSpace <= 0) {
        logger.warn(
          `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
        )
        return res.status(403).json({
          message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
        })
      }
      const allowedPoints = Math.min(rewardAmount, availableSpace)

      // Add to total rewards and streak rewards of the user
      user.totalRewards += allowedPoints
      user.streakRewards += allowedPoints
      user.balanceRewards += allowedPoints

      // Set the claimed reward to 0
      user.streak.watchStreak.watchStreakReward[index] -= allowedPoints

      await user.save()
      // Save the reward record
      await saveStreakReward(user, allowedPoints)
      await updateDailyEarnedRewards(user._id, telegramId, allowedPoints);


      logger.info(
        `Watch Streak Reward claimed successfully for telegramId: ${telegramId}`
      )

      res.status(200).json({
        message: `Watch Streak Rewards claimed successfully. Claimed: ${allowedPoints}`,
        claimedReward: allowedPoints,
        remainingReward: rewardAmount - allowedPoints,
        watchStreak: user.streak.watchStreak,
        totalRewards: user.totalRewards,
        balanceRewards: user.balanceRewards
      })
    } else {
      logger.warn(
        `No Watch Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
      )
      res
        .status(400)
        .json({ message: 'User has no Watch Streak rewards to claim' })
    }
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown' // Handle undefined telegramId
    const index = req.body?.index !== undefined ? req.body.index : 'unknown'
    logger.error(
      `Error while claiming Watch Streak Reward for telegramId: ${telegramId}, index: ${index}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
    next(err)
  }
}

const referStreakRewardClaim = async (req, res, next) => {
  try {
    const { telegramId, index } = decryptedDatas(req);
    // const { telegramId, index } = req.body;

    logger.info(
      `Attempting to claim Refer Streak Reward for telegramId: ${telegramId}, index: ${index}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const currentDate = new Date()

    // Check if reward is valid
    if (
      user.streak.referStreak.referStreakReward.length > 0 &&
      user.streak.referStreak.referStreakReward[index] !== 0
    ) {
      const rewardAmount = user.streak.referStreak.referStreakReward[index]
      if (rewardAmount <= 0) {
        logger.warn(
          `No refer Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
        )
        return res.status(400).json({ message: 'No rewards to claim.' })
      }
      // Calculate the total available reward space globally
      const totalRewardsInSystem = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
      ])
      const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
      const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

      if (availableSpace <= 0) {
        logger.warn(
          `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
        )
        return res.status(403).json({
          message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
        })
      }

      // Determine how much reward can be claimed
      const allowedPoints = Math.min(rewardAmount, availableSpace)

      // Update user's rewards
      user.totalRewards += allowedPoints
      user.streakRewards += allowedPoints
      user.balanceRewards += allowedPoints

      // Reduce the reward amount or mark it as fully claimed
      user.streak.referStreak.referStreakReward[index] -= allowedPoints

      // Save the user record
      await user.save()

      // Save reward record and update daily rewards
      await saveStreakReward(user, allowedPoints)
      await updateDailyEarnedRewards(user._id, telegramId, allowedPoints);

      logger.info(
        `Refer Streak Reward claimed successfully for telegramId: ${telegramId}`
      )
      return res.status(200).json({
        message: 'Refer Streak Rewards claimed successfully',
        claimedReward: allowedPoints,
        remainingReward: rewardAmount - allowedPoints,
        referStreak: user.streak.referStreak,
        totalRewards: user.totalRewards,
        balanceRewards: user.balanceRewards
      })
    } else {
      logger.warn(
        `No Refer Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
      )
      return res
        .status(400)
        .json({ message: 'User has no Refer Streak rewards to claim.' })
    }
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown'
    const index = req.body?.index !== undefined ? req.body.index : 'unknown'
    logger.error(
      `Error while claiming Refer Streak Reward for telegramId: ${telegramId}, index: ${index}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
  
    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
}

const taskStreakRewardClaim = async (req, res, next) => {
  try {
    const { telegramId, index } = decryptedDatas(req);
    // const { telegramId, index } = req.body;

    // Log the incoming request
    logger.info(
      `Attempting to claim Task Streak Reward for telegramId: ${telegramId}, index: ${index}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const currentDate = new Date()

    if (
      user.streak.taskStreak.taskStreakReward.length > 0 &&
      user.streak.taskStreak.taskStreakReward[index] != 0
    ) {
      const rewardAmount = user.streak.taskStreak.taskStreakReward[index]
      if (rewardAmount <= 0) {
        logger.warn(
          `No Login Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
        )
        return res.status(400).json({ message: 'No rewards to claim.' })
      }
      const totalRewardsInSystem = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
      ])
      const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
      const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

      if (availableSpace <= 0) {
        logger.warn(
          `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
        )
        return res.status(403).json({
          message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
        })
      }

      // Determine how much reward can be claimed
      const allowedPoints = Math.min(rewardAmount, availableSpace)

      // Add to total rewards and streak rewards of the user
      user.totalRewards += allowedPoints
      user.streakRewards += allowedPoints
      user.balanceRewards += allowedPoints

      // Set the claimed reward to 0
      user.streak.taskStreak.taskStreakReward[index] -= allowedPoints

      await user.save()
      // Save the reward record
      await saveStreakReward(user, rewardAmount)
      await updateDailyEarnedRewards(user._id, telegramId, rewardAmount);

      logger.info(
        `Task Streak Reward claimed successfully for telegramId: ${telegramId}`
      )

      res.status(200).json({
        message: 'Task Streak Rewards claimed successfully',
        claimedReward: allowedPoints,
        remainingReward: rewardAmount - allowedPoints,
        TaskStreak: user.streak.taskStreak,
        totalRewards: user.totalRewards,
        balanceRewards: user.balanceRewards
      })
    } else {
      logger.warn(
        `No Task Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
      )
      res
        .status(400)
        .json({ message: 'User has no Task Streak rewards to claim' })
    }
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown' // Handle undefined telegramId
    const index = req.body?.index !== undefined ? req.body.index : 'unknown'
    logger.error(
      `Error while claiming Task Streak Reward for telegramId: ${telegramId}, index: ${index}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
  
    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
}

const multiStreakRewardClaim = async (req, res, next) => {
  try {
    const { telegramId, index } = decryptedDatas(req);
    // const { telegramId, index } = req.body;

    // Log the incoming request
    logger.info(
      `Attempting to claim Multi Streak Reward for telegramId: ${telegramId}, index: ${index}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    const currentDate = new Date()

    if (
      user.streak.multiStreak.multiStreakReward.length > 0 &&
      user.streak.multiStreak.multiStreakReward[index] !== 0
    ) {
      const rewardAmount = user.streak.multiStreak.multiStreakReward[index]

      // Validate reward amount
      if (rewardAmount <= 0) {
        logger.warn(
          `No Multi Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
        )
        return res.status(400).json({ message: 'No rewards to claim.' })
      }

      const totalRewardsInSystem = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
      ])
      const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
      const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

      if (availableSpace <= 0) {
        logger.warn(
          `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
        )
        return res.status(403).json({
          message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
        })
      }
      const allowedPoints = Math.min(rewardAmount, availableSpace)

      user.totalRewards += allowedPoints
      user.streakRewards += allowedPoints
      user.balanceRewards += allowedPoints

      // Set the claimed reward to 0
      user.streak.multiStreak.multiStreakReward[index] -= allowedPoints

      await user.save()
      // Save the reward record
      await saveStreakReward(user, allowedPoints)
      await updateDailyEarnedRewards(user._id, telegramId, allowedPoints);

      logger.info(
        `Multi Streak Reward claimed successfully for telegramId: ${telegramId}`
      )

      res.status(200).json({
        message: 'Multi Streak Rewards claimed successfully',
        claimedReward: allowedPoints,
        remainingReward: rewardAmount - allowedPoints,
        multiStreak: user.streak.multiStreak,
        totalRewards: user.totalRewards,
        balanceRewards: user.balanceRewards
      })
    } else {
      logger.warn(
        `No Multi Streak rewards to claim for telegramId: ${telegramId}, index: ${index}`
      )
      res
        .status(400)
        .json({ message: 'User has no Multi Streak rewards to claim' })
    }
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown' // Handle undefined telegramId
    const index = req.body?.index !== undefined ? req.body.index : 'unknown'
    logger.error(
      `Error while claiming Multi Streak Reward for telegramId: ${telegramId}, index: ${index}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
  
    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
}

const streakOfStreakRewardClaim = async (req, res, next) => {
  try {
    const { telegramId } = decryptedDatas(req);
    // const { telegramId } = req.body;

    // Log the incoming request
    logger.info(
      `Attempting to claim Streak of Streak Rewards for telegramId: ${telegramId}`
    )

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Calculate total Streak of Streak rewards
    const streakOfStreakRewards =
      user.streak.multiStreak.streakOfStreakRewards || []
    const rewardAmount = streakOfStreakRewards.reduce(
      (sum, reward) => sum + reward,
      0
    )

    // Validate if there are rewards to claim
    if (rewardAmount <= 0) {
      logger.warn(
        `No Streak of Streak rewards available for telegramId: ${telegramId}`
      )
      return res.status(400).json({ message: 'No rewards to claim.' })
    }

    // Calculate available space in the global limit
    const totalRewardsInSystem = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$balanceRewards' } } }
    ])
    const totalRewardsUsed = totalRewardsInSystem[0]?.total || 0
    const availableSpace = TOTALREWARDS_LIMIT - totalRewardsUsed

    if (availableSpace <= 0) {
      logger.warn(
        `The total rewards limit of ${TOTALREWARDS_LIMIT} has been reached.`
      )
      return res.status(403).json({
        message: `Total rewards limit of ${TOTALREWARDS_LIMIT} exceeded across all users.`
      })
    }

    // Determine how much reward can be claimed
    const allowedPoints = Math.min(rewardAmount, availableSpace)

    // Update user's rewards
    user.totalRewards += allowedPoints
    user.streakRewards += allowedPoints
    user.balanceRewards += allowedPoints

    // Update the last SOS reward value
    for(let i=user.streak.multiStreak.streakOfStreakRewards.length - 1;i>=0;i--){
      console.log("inisde for loop lastSOSReward update");
      console.log(user.streak.multiStreak.streakOfStreakRewards);
      console.log(user.streak.multiStreak.streakOfStreakRewards.length);
      console.log(user.streak.multiStreak.streakOfStreakRewards[i]);
      if(user.streak.multiStreak.streakOfStreakRewards[i]!=0){
        console.log("inisde lastSOSReward update");
        user.streak.multiStreak.lastSOSReward = user.streak.multiStreak.streakOfStreakRewards[i];
      }
    }

    // Reset streak of streak rewards only for the claimed amount
    user.streak.multiStreak.streakOfStreakRewards.fill(0)
    
    await user.save()

    // Save the reward record
    await saveStreakReward(user, allowedPoints)
    await updateDailyEarnedRewards(user._id, telegramId, allowedPoints);

    logger.info(
      `Streak of Streak Rewards claimed successfully for telegramId: ${telegramId}`
    )
    return res.status(200).json({
      message: 'Streak of Streak Rewards claimed successfully.',
      claimedReward: allowedPoints,
      remainingReward: rewardAmount - allowedPoints,
      multiStreak: user.streak.multiStreak,
      SOSRewardClaimed: allowedPoints,
      totalRewards: user.totalRewards,
      balanceRewards: user.balanceRewards
    })
  } catch (err) {
    const telegramId = req.body?.telegramId || 'unknown'
    logger.error(
      `Error while claiming Streak of Streak Rewards for telegramId: ${telegramId}. Error: ${err.message}`
    )
    res.status(500).json({
      message: 'Something went wrong'
    });
  
    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
}

const unClaimedStreakRewardsClaim = async user => {
  try {
    const unClaimedLoginReward = Number(
      user.streak.loginStreak.unClaimedLoginStreakReward
    )
    const unClaimedWatchReward = Number(
      user.streak.watchStreak.unClaimedWatchStreakReward
    )
    const unClaimedReferReward = Number(
      user.streak.referStreak.unClaimedReferStreakReward
    )
    const unClaimedTaskReward = Number(
      user.streak.taskStreak.unClaimedTaskStreakReward
    )
    const unClaimedMultiReward = Number(
      user.streak.multiStreak.unClaimedMultiStreakReward
    )
    const unClaimedSOSReward = Number(
      user.streak.multiStreak.unClaimedStreakOfStreakRewards
    )
    if (
      unClaimedLoginReward != 0 ||
      unClaimedWatchReward != 0 ||
      unClaimedReferReward != 0 ||
      unClaimedTaskReward != 0 ||
      unClaimedMultiReward != 0 ||
      unClaimedSOSReward != 0
    ) {
      const rewardAmount =
        unClaimedLoginReward +
        unClaimedWatchReward +
        unClaimedReferReward +
        unClaimedTaskReward +
        unClaimedMultiReward +
        unClaimedSOSReward
      // add to total reward of users
      user.totalRewards += rewardAmount
      // add to streak reward of users
      user.streakRewards += rewardAmount
      // add to balancerewards
      user.balanceRewards += rewardAmount;

      user.streak.loginStreak.unClaimedLoginStreakReward = 0
      user.streak.watchStreak.unClaimedWatchStreakReward = 0
      user.streak.referStreak.unClaimedReferStreakReward = 0
      user.streak.taskStreak.unClaimedTaskStreakReward = 0
      user.streak.multiStreak.unClaimedMultiStreakReward = 0
      user.streak.multiStreak.unClaimedStreakOfStreakRewards = 0
    } else {
    }
  } catch (err) {
    res.status(500).json({
      message: 'Something went wrong'
    });
  
    // Optionally, you can call next(err) if you still want to pass the error to an error-handling middleware.
    next(err);
  }
}


const userStreaks = async (req, res, next) => {
  try {
    let { telegramId } = req.params

    // Trim leading and trailing spaces
    telegramId = telegramId.trim()

    // Log the incoming request with the telegramId
    logger.info(`Fetching streak details for telegramId: ${telegramId}`)

    // Find the user detail document for the given telegramId
    const user = await User.findOne({ telegramId: telegramId })

    // Check if user detail was found
    if (!user) {
      logger.warn(`User not found for telegramId: ${telegramId}`)
      return res.status(404).json({ message: 'User not found' })
    }

    // Log the retrieved user streak details
    logger.info(`User streak details retrieved for telegramId: ${telegramId}`)

    // Return the user streak details in the response
    return res.status(200).json(user.streak)
  } catch (err) {
    // Log the error
    logger.error(
      `An error occurred while fetching streak details for telegramId: ${telegramId}. Error: ${err.message}`
    )

    // Handle any errors that occur
    res.status(500).json({
      message: 'Something went wrong'
    });
    next(err)
  }
}

const watchStreakCheck = async (req, res, next) => {
  try {
    let { telegramId } = req.params;
    telegramId = telegramId.trim();

    // Get the current date
    const currentDate = new Date();

    // Get start and end of today
    const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));

    logger.info(`Fetching streak details for telegramId: ${telegramId} on ${startOfDay.toISOString().split("T")[0]}`);

    // Find today's record using the date range
    const dailyRecord = await userDailyreward.findOne(
      {
        telegramId,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      },
      {
        dailyMemeCount: 1,
        telegramId: 1,
        createdAt: 1,
        updatedAt: 1,
      }
    );

    if (!dailyRecord) {
      logger.info(`No dailyReward details found for telegramId: ${telegramId} on ${startOfDay.toISOString().split("T")[0]}`);
      return res.status(404).json({ message: "No dailyReward record found for today" });
    }

    res.status(200).json(dailyRecord);

  } catch (err) {
    logger.error(`Error fetching dailyReward details for telegramId: ${telegramId}. Error: ${err.message}`);
    res.status(500).json({ message: "Something went wrong" });
    next(err);
  }
};

module.exports = {
  streak,
  calculateLoginStreak,
  calculateWatchStreak,
  calculateReferStreak,
  calculateTaskStreak,
  streakOfStreak,
  loginStreakRewardClaim,
  watchStreakRewardClaim,
  referStreakRewardClaim,
  taskStreakRewardClaim,
  multiStreakRewardClaim,
  streakOfStreakRewardClaim,
  userStreaks,
  watchStreakCheck
}
