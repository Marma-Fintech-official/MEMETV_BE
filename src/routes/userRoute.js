const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  login,
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

router.use(errors())

module.exports = router
