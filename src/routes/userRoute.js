const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  login,
  userDetails,
  userGameRewards,
  purchaseGameCards,
  weekRewards,
  userTaskRewards,
  addWalletAddress,
  tutorialStatus
} = require('../controllers/userController')

router.post(
  '/login',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      name: Joi.string().required(),
      referredById: Joi.string().optional(),
      telegramId: Joi.string().required()
    })
  }),
  login
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

router.get(
  '/userDetails/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  userDetails
)

router.post(
  '/userGameRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      gamePoints: Joi.string().optional(),
      boosters: Joi.array().items(Joi.string()).optional()
    })
  }),
  userGameRewards
)

router.post(
  '/userTaskRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      taskPoints: Joi.string().required(),
      channel: Joi.string().required()
    })
  }),
  userTaskRewards
)

router.post(
  '/purchaseGameCards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      gamePoints: Joi.string().required()
    })
  }),
  purchaseGameCards
)

router.get(
  '/weekRewards/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  weekRewards
)

router.post(
  '/addWalletAddress/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    }),
    [Segments.BODY]: Joi.object().keys({
      userWalletAddress: Joi.string().required()
    })
  }),
  addWalletAddress
)

router.use(errors())

module.exports = router
