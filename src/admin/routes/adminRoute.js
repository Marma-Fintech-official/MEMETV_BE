const express = require ('express');
const router = express.Router();
const {adminLogin, updatePassword,adminLogout, getTotalusers, individualsRewards, protect} = require('../controller/adminController')
const { getMintedTokens } = require('../../controllers/userController');


router.get("/getTotalrewards", protect, getMintedTokens)
router.get('/getTotalusers', protect, getTotalusers);
// router.get('/getTotalrewards', getTotalRewards);
router.get('/getIndividualrewards', protect, individualsRewards);
router.post('/adminLogin', adminLogin);
router.post('/updatePassword', updatePassword);
router.post('/logout', adminLogout);






module.exports = router;    