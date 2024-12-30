const TelegramBot = require('node-telegram-bot-api');
const logger = require('../helpers/logger');

class TelegramBotService {
    constructor(token) {
        this.bot = new TelegramBot(token);
        this.setupCommandHandlers();
    }

    setupCommandHandlers() {
        this.bot.onText(/\/start(?:\s+(\w+))?/, this.handleStartCommand.bind(this));
    }

    async handleStartCommand(msg, match) {
        try {
            const chatId = msg.chat.id;
            const referredId = match[1];
            logger.info(`Received start command with referredId: ${referredId}`);

            await this.bot.sendMessage(
                chatId,
                'Hello! Welcome to The Meme TV: Watch videos, play games, invite friends, and earn points. Boost rewards and stake your way to even more fun!',
                {
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: '#doNothing',
                                web_app: {
                                    url: `${process.env.WEBAPP_URL}?start=${referredId}`
                                }
                            }
                        ]]
                    }
                }
            );
        } catch (error) {
            logger.error('Error handling start command:', error);
        }
    }
}

const initializeTelegramBot = () => {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) {
        throw new Error('TELEGRAM_TOKEN is not configured');
    }
    return new TelegramBotService(token);
};

module.exports = { initializeTelegramBot };