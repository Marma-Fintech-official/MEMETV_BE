const express = require('express');
const { validatePromocode, yearlyEarnedreward} = require('../controllers/promoCodeController');
const router = express.Router();
const { commonPayload } = require('../helpers/validation');
const { celebrate } = require('celebrate');

router.post('/validatePromocode', celebrate(commonPayload), validatePromocode);
router.post('/earnedreward',  yearlyEarnedreward);

module.exports = router;
