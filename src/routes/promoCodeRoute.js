const express = require('express');
const { validatePromocode, earlyEarnedreward} = require('../controllers/promoCodeController');
const router = express.Router();
const { commonPayload } = require('../helpers/validation');
const { celebrate } = require('celebrate');

router.post('/validatePromocode', celebrate(commonPayload), validatePromocode);
router.post('/earnedreward',celebrate(commonPayload) , earlyEarnedreward);

module.exports = router;
