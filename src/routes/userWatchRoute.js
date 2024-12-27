const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  userWatchRewards,
  userDetails,
  boosterDetails,
  popularUser,
  yourReferrals,
  tutorialStatus
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
  '/userDetails/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  userDetails
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


router.post('/tutorialStatus/:telegramId',celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    telegramId: Joi.string().required()
  }),
  [Segments.BODY]: Joi.object().keys({
    tutorialStatus: Joi.boolean().required()
  })
}),
tutorialStatus
)


router.use(errors())

module.exports = router
