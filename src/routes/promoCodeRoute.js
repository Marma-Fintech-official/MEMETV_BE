const express = require('express');
const { validatePromocode} = require('../controllers/promoCodeController');
const router = express.Router();
const { commonPayload } = require('../helpers/validation');
const { celebrate } = require('celebrate');

router.post('/validatePromocode', celebrate(commonPayload), validatePromocode);

module.exports = router;
