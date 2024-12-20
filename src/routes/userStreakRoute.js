const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  streak,
  streakOfStreak,
  loginStreakRewardClaim,
  watchStreakRewardClaim,
  referStreakRewardClaim,
  taskStreakRewardClaim,
  multiStreakRewardClaim,
  streakOfStreakRewardClaim,
  // unClaimedStreakRewardsClaim,
  updateClaimedLoginDaysArray,
  updateClaimedWatchDaysArray,
  updateClaimedReferDaysArray,
  updateClaimedTaskDaysArray,
  updateClaimedMultiDaysArray,
  userStreaks
} = require('../controllers/userStreakController')

router.post(
  '/streak',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      userWatchSeconds: Joi.number().required()
    })
  }),
  streak
)

router.post(
  '/streakOfStreak',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  streakOfStreak
)

router.post(
  '/loginStreakRewardClaim',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      index: Joi.number().required()
    })
  }),
  loginStreakRewardClaim
)

router.post(
  '/watchStreakRewardClaim',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      index: Joi.number().required()
    })
  }),
  watchStreakRewardClaim
)

router.post(
  '/referStreakRewardClaim',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      index: Joi.number().required()
    })
  }),
  referStreakRewardClaim
)

router.post(
  '/taskStreakRewardClaim',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      index: Joi.number().required()
    })
  }),
  taskStreakRewardClaim
)

router.post(
  '/multiStreakRewardClaim',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      index: Joi.number().required()
    })
  }),
  multiStreakRewardClaim
)

router.post(
  '/streakOfStreakRewardClaim',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  streakOfStreakRewardClaim
)

// router.post(
//   "/unClaimedStreakRewardsClaim",
//   celebrate({
//     [Segments.BODY]: Joi.object().keys({
//       telegramId: Joi.string().required()
//     }),
//   }),
//   unClaimedStreakRewardsClaim
// );

router.post(
  '/updateClaimedLoginDaysArray',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      claimedDayArray: Joi.array().required()
    })
  }),
  updateClaimedLoginDaysArray
)

router.post(
  '/updateClaimedWatchDaysArray',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      claimedDayArray: Joi.array().required()
    })
  }),
  updateClaimedWatchDaysArray
)

router.post(
  '/updateClaimedReferDaysArray',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      claimedDayArray: Joi.array().required()
    })
  }),
  updateClaimedReferDaysArray
)

router.post(
  '/updateClaimedTaskDaysArray',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      claimedDayArray: Joi.array().required()
    })
  }),
  updateClaimedTaskDaysArray
)

router.post(
  '/updateClaimedMultiDaysArray',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      claimedDayArray: Joi.array().required()
    })
  }),
  updateClaimedMultiDaysArray
)

router.get(
  '/userStreaks/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  userStreaks
)

router.use(errors())
module.exports = router
