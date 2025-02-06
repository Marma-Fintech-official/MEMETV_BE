const jwt = require('jsonwebtoken');
const mongoose = require('monggose');
const TokenBlacklist = require('../models/tokenBlacklist');


const authenticateAdmin = async (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) {
        return res.status(401).json({ message: 'Access Denied. No token provided.' });
    }

    // Check if token is blacklisted
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) {
        return res.status(401).json({ message: 'Token has been invalidated. Please log in again.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded; // Attach admin info to request
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid Token' });
    }
};

module.exports = authenticateAdmin;
