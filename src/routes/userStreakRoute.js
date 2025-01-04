const express = require("express");
const router = express.Router();
const { celebrate, Joi, errors, Segments } = require("celebrate");
const {
  streak,
  streakOfStreak,
  loginStreakRewardClaim,
  watchStreakRewardClaim,
  referStreakRewardClaim,
  taskStreakRewardClaim,
  multiStreakRewardClaim,
  streakOfStreakRewardClaim,
  updateClaimedLoginDaysArray,
  updateClaimedWatchDaysArray,
  updateClaimedReferDaysArray,
  updateClaimedTaskDaysArray,
  updateClaimedMultiDaysArray,
  userStreaks,
} = require("../controllers/userStreakController");
const { commonPayload } = require("../helpers/validation");

router.post("/streak", celebrate(commonPayload), streak);

router.post("/streakOfStreak", celebrate(commonPayload), streakOfStreak);

router.post(
  "/loginStreakRewardClaim",
  celebrate(commonPayload),
  loginStreakRewardClaim
);

router.post(
  "/watchStreakRewardClaim",
  celebrate(commonPayload),
  watchStreakRewardClaim
);

router.post(
  "/referStreakRewardClaim",
  celebrate(commonPayload),
  referStreakRewardClaim
);

router.post(
  "/taskStreakRewardClaim",
  celebrate(commonPayload),
  taskStreakRewardClaim
);

router.post(
  "/multiStreakRewardClaim",
  celebrate(commonPayload),
  multiStreakRewardClaim
);

router.post(
  "/streakOfStreakRewardClaim",
  celebrate(commonPayload),
  streakOfStreakRewardClaim
);

router.post(
  "/updateClaimedLoginDaysArray",
  celebrate(commonPayload),
  updateClaimedLoginDaysArray
);

router.post(
  "/updateClaimedWatchDaysArray",
  celebrate(commonPayload),
  updateClaimedWatchDaysArray
);

router.post(
  "/updateClaimedReferDaysArray",
  celebrate(commonPayload),
  updateClaimedReferDaysArray
);

router.post(
  "/updateClaimedTaskDaysArray",
  celebrate(commonPayload),
  updateClaimedTaskDaysArray
);

router.post(
  "/updateClaimedMultiDaysArray",
  celebrate(commonPayload),
  updateClaimedMultiDaysArray
);

router.get(
  "/userStreaks/:telegramId",
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required(),
    }),
  }),
  userStreaks
);

router.use(errors());
module.exports = router;
