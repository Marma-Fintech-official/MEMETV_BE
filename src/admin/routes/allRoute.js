const express = require('express');
const adminRouter = express.Router();

adminRouter.use('/', require('./adminRoute'));

module.exports = adminRouter;