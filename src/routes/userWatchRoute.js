const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const {
  userWatchRewards,
  userDetails,
  boosterDetails,
  popularUser,
  yourReferrals,
  tutorialStatus,
  stakingHistory,
  addWalletAddress,
  dailyRewards
} = require('../controllers/userWatchController')

router.post(
  '/userWatchRewards',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required(),
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


router.post('/tutorialStatus',celebrate({
  [Segments.BODY]: Joi.object().keys({
    encryptedData: Joi.string().required(),
    iv: Joi.required(),
  })
}),
tutorialStatus
)

router.get('/stakingHistory/:telegramId', celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    telegramId: Joi.string().required()
  }) 
}),
stakingHistory
)

router.post(
  '/addWalletAddress/:telegramId',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      telegramId: Joi.string().required(),
      userWalletAddress: Joi.string().required()
    })
  }),
  addWalletAddress
)

router.get(
  '/dailyRewards/:telegramId',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      telegramId: Joi.string().required()
    })
  }),
  dailyRewards
)



router.use(errors())

module.exports = router
