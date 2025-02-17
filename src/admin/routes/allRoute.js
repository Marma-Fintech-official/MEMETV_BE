const express = require('express');
const adminRouter = express.Router();

adminRouter.use('/', require('./adminRoute'));
adminRouter.use('/', require('./socialAuthRoute'));

module.exports = adminRouter;