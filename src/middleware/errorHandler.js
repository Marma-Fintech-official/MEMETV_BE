const logger = require('../helpers/logger');

// Custom error classes
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
        this.name = 'ValidationError';
    }
}

class AuthenticationError extends AppError {
    constructor(message) {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
    });

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error',
            errors: err.errors || err.message
        });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({
            status: 'fail',
            message: 'Invalid ID format'
        });
    }

    if (err.code === 11000) {
        return res.status(400).json({
            status: 'fail',
            message: 'Duplicate field value'
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            status: 'fail',
            message: 'Invalid token. Please log in again'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            status: 'fail',
            message: 'Token expired. Please log in again'
        });
    }

    // Development vs Production error responses
    if (process.env.NODE_ENV === 'development') {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }

    // Production error response
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }

    // Programming or unknown errors: don't leak error details
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong'
    });
};

// Async error handler wrapper
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Request validation middleware
const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const { error } = schema.validate(req.body);
            if (error) {
                throw new ValidationError(error.details[0].message);
            }
            next();
        } catch (err) {
            next(err);
        }
    };
};

// Not Found middleware
const notFound = (req, res, next) => {
    const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
    next(error);
};

// Rate limit error handler
const rateLimitHandler = (req, res) => {
    throw new AppError('Too many requests from this IP', 429);
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    errorHandler,
    catchAsync,
    validateRequest,
    notFound,
    rateLimitHandler
};