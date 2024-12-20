const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  userWatchRewards,
  boosterDetails,
  purchaseBooster,
  stakingRewards,
  popularUser,
  yourReferrals,
  getQuizQuestions
} = require('../controllers/userWatchController')

router.post(
  '/userWatchRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      userWatchSeconds: Joi.number().optional(),
      boosterPoints: Joi.string().optional(),
      boosters: Joi.array().items(Joi.string()).optional()
    })
  }),
  userWatchRewards
)

router.get(
  '/boosterDetails/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  boosterDetails
)

router.post(
  '/purchaseBooster',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      boosterPoints: Joi.string().required(),
      booster: Joi.string().required(),
      boosterCount: Joi.number().required()
    })
  }),
  purchaseBooster
)

router.post(
  '/stakingRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      stakingId: Joi.string().required()
    })
  }),
  stakingRewards
)

router.get(
  '/popularUser/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  popularUser
)

router.get(
  '/yourReferrals/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  yourReferrals
)

router.get(
  '/getquizQuestions/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  getQuizQuestions
)

router.use(errors())

module.exports = router
