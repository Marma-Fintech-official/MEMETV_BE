const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  login,
  userGameRewards,
  userTaskRewards,
  purchaseBooster,
  purchaseGameCards
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
  '/purchaseGameCards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      gamePoints: Joi.string().required()
    })
  }),
  purchaseGameCards
)

router.use(errors())

module.exports = router
