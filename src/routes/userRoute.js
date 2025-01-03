const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  login,
  userGameRewards,
  userTaskRewards,
  purchaseBooster,
  purchaseGameCards,
  stakingRewards
} = require('../controllers/userController')

router.post(
  '/login',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
    })
  }),
  login
)

router.post(
  '/userGameRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
    })
  }),
  userGameRewards
)

router.post(
  '/userTaskRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
    })
  }),
  userTaskRewards
)

router.post(
  '/purchaseBooster',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
    })
  }),
  purchaseBooster
)

router.post(
  '/purchaseGameCards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
    })
  }),
  purchaseGameCards
)

router.post(
  '/stakingRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
    })
  }),
  stakingRewards
)

router.use(errors())

module.exports = router
