const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  userWatchRewards,
  deactiveBooster,
  userDetails,
  boosterDetails,
  popularUser,
  yourReferrals,
  tutorialStatus,
  stakingHistory,
  addWalletAddress,
  dailyRewards,
  getMemes
} = require('../controllers/userWatchController')
const { commonPayload } = require('../helpers/validation')

router.post('/userWatchRewards', celebrate(commonPayload), userWatchRewards)

router.post('/deactiveBooster',celebrate(commonPayload), deactiveBooster)

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

router.post('/tutorialStatus', celebrate(commonPayload), tutorialStatus)

router.get(
  '/stakingHistory/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  stakingHistory
)

router.post('/addWalletAddress', celebrate(commonPayload), addWalletAddress)

router.get(
  '/dailyRewards/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  dailyRewards
)

router.get(
  '/getMemes/:lastViewedMemeId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      lastViewedMemeId: Joi.number().required()
    })
  }),
  getMemes
)

router.use(errors())

module.exports = router
