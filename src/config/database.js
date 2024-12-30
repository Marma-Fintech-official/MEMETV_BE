const mongoose = require('mongoose');
const logger = require('../helpers/logger');

const connectDatabase = async () => {
    try {
        await mongoose.connect(process.env.DBURL, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true,
            retryReads: true
        });
        
        logger.info('🛡️ 🔍 Successfully Connected to MongoDB 🛡️ 🔍');
        
        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

    } catch (error) {
        logger.error('MongoDB Connection Failure:', error);
        throw error;
    }
};

module.exports = { connectDatabase };