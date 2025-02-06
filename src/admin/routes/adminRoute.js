const express = require ('express');
const router = express.Router();
const {adminLogin, updatePassword,adminLogout, getTotalusers, individualsRewards} = require('../controller/adminController')
const { getMintedTokens } = require('../../controllers/userController');


router.get("/getTotalrewards", getMintedTokens)
router.get('/getTotalusers', getTotalusers);
// router.get('/getTotalrewards', getTotalRewards);
router.get('/getIndividualrewards', individualsRewards);
router.post('/adminLogin', adminLogin);
router.post('/updatePassword', updatePassword);
router.post('/logout', adminLogout);






module.exports = router;