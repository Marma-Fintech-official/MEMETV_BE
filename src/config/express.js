const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { errorHandler } = require('../middleware/errorHandler');
const routes = require('../routes/allRoutes');

const initializeExpress = () => {
    const app = express();

    // Security Middleware
    app.use(helmet());
    app.use(cors());

    // Request Processing Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(morgan('combined'));

    // Rate Limiter
    const limiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 1000,
        message: 'Too many requests from this IP, please try again later.'
    });
    app.use(limiter);

    // Routes
    app.use('/api', routes);
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'healthy' });
    });
    app.get('/', (req, res) => {
        res.send(' ***🔥🔥 TheMemeTv Backend Server is Running 🔥🔥*** ');
    });

    // Error Handling
    app.use(errorHandler);

    return app;
};

module.exports = { initializeExpress };