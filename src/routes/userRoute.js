const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  login,
  userGameRewards
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

router.use(errors())

module.exports = router
