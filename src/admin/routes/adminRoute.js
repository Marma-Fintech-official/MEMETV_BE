const express = require ('express');
const router = express.Router();
const {getTotalusers, getTotalRewards, individualsRewards} = require('../controller/adminController')

router.get('/getTotalusers', getTotalusers);
router.get('/getTotalrewards', getTotalRewards);
router.get('/getIndividualrewards', individualsRewards);



module.exports = router;