const express = require('express');
const router = express.Router();
const { celebrate, errors } = require('celebrate');
const {
  login,
  userGameRewards,
  userTaskRewards,
  purchaseBooster,
  purchaseGameCards,
  stakingRewards,
  getMintedTokens
} = require('../controllers/userController');
const { commonPayload } = require('../helpers/validation');

router.post('/login', celebrate(commonPayload), login);

router.post('/userGameRewards',celebrate(commonPayload),userGameRewards);

router.post('/userTaskRewards', celebrate(commonPayload), userTaskRewards);

router.post('/purchaseBooster', purchaseBooster);

router.post('/purchaseGameCards', celebrate(commonPayload), purchaseGameCards);

router.post('/stakingRewards', celebrate(commonPayload), stakingRewards);

router.get("/getMintedTokens", getMintedTokens)

router.use(errors());

module.exports = router;
