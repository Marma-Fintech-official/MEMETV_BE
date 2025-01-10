const express = require('express');
const { validatePromocode} = require('../controllers/promoCodeController');
const router = express.Router();

router.post('/validatePromocode', validatePromocode);

module.exports = router;
