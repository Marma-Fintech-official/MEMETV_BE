const express = require('express')
const router = express.Router()
const { celebrate, Joi, errors, Segments } = require('celebrate')
const { getBattleByDate, userChooseTeam, getTeamVotesByDate } = require('../controllers/userVoteController')

router.get(
  '/getBattleByDate',
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      date: Joi.string().isoDate().required()
    })
  }),
  getBattleByDate
)

router.get('/getTeamVotesByDate', getTeamVotesByDate);

router.post(
  '/userChooseTeam',
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      teamId: Joi.string().required(),
      telegramId: Joi.string().required(),
    })
  }),
  userChooseTeam
)

router.use(errors())

module.exports = router
