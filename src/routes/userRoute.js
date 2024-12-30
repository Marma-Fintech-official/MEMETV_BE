const express = require('express');
const router = express.Router();
const { celebrate, Joi, errors, Segments } = require('celebrate');
const { catchAsync, validateRequest, AppError } = require('../middleware/errorHandler');
const {
  login,
  userGameRewards,
  userTaskRewards, 
  purchaseBooster,
  purchaseGameCards,
  stakingRewards
} = require('../controllers/userController');

class UserRoutes {
    constructor() {
        this.setupRoutes();
    }

    setupRoutes() {
        router.post(
            '/login',
            celebrate({
                [Segments.BODY]: Joi.object().keys({
                    name: Joi.string().required(),
                    referredById: Joi.string().optional(),
                    telegramId: Joi.string().required()
                })
            }),
            catchAsync(async (req, res) => {
                const result = await login(req, res);
                res.status(200).json(result);
            })
        );

        router.post(
            '/userGameRewards',
            celebrate({
                [Segments.BODY]: Joi.object().keys({
                    telegramId: Joi.string().required(),
                    gamePoints: Joi.string().optional(),
                    boosters: Joi.array().items(Joi.string()).optional()
                })
            }),
            catchAsync(async (req, res) => {
                const result = await userGameRewards(req, res);
                res.status(200).json(result);
            })
        );

        // Task rewards route
        router.post(
            '/userTaskRewards',
            celebrate({
                [Segments.BODY]: Joi.object().keys({
                    telegramId: Joi.string().required(),
                    taskPoints: Joi.string().required(),
                    channel: Joi.string().required()
                })
            }),
            catchAsync(async (req, res) => {
                const result = await userTaskRewards(req, res);
                res.status(200).json(result);
            })
        );

        router.post(
            '/purchaseBooster',
            celebrate({
                [Segments.BODY]: Joi.object().keys({
                    telegramId: Joi.string().required(),
                    boosterPoints: Joi.string().required(),
                    booster: Joi.string().required(),
                    boosterCount: Joi.number().required()
                })
            }),
            catchAsync(async (req, res) => {
                const result = await purchaseBooster(req, res);
                res.status(200).json(result);
            })
        );

        router.post(
            '/purchaseGameCards',
            celebrate({
                [Segments.BODY]: Joi.object().keys({
                    telegramId: Joi.string().required(),
                    gamePoints: Joi.string().required()
                })
            }),
            catchAsync(async (req, res) => {
                const result = await purchaseGameCards(req, res);
                res.status(200).json(result);
            })
        );

        router.post(
            '/stakingRewards',
            celebrate({
                [Segments.BODY]: Joi.object().keys({
                    stakingId: Joi.string().required()
                })
            }),
            catchAsync(async (req, res) => {
                const result = await stakingRewards(req, res);
                res.status(200).json(result);
            })
        );

        router.use(errors());
        
        router.use((req, res, next) => {
            next(new AppError(`Not found - ${req.originalUrl}`, 404));
        });

        return router;
    }

    validateTelegramId(telegramId) {
        if (!telegramId) {
            throw new AppError('Telegram ID is required', 400);
        }
    }

    validatePoints(points) {
        if (isNaN(points) || points < 0) {
            throw new AppError('Invalid points value', 400);
        }
    }
}

const userRoutes = new UserRoutes();
module.exports = userRoutes.setupRoutes();