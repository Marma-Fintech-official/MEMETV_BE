const cluster = require('cluster');
const os = require('os');
const { initializeExpress } = require('./src/config/express');
const { connectDatabase } = require('./src/config/database');
const { initializeTelegramBot } = require('./src/services/telegramBot');
const logger = require('./src/helpers/logger');
require('dotenv').config();

class Application {
    static async initialize() {
        if (cluster.isMaster) {
            await this.initializeMaster();
        }
    }

    static async initializeMaster() {
        try {
            // Initialize Telegram Bot
            await initializeTelegramBot();

            // Fork workers
            this.forkWorkers();

            // Initialize Express and Database
            const app = initializeExpress();
            await connectDatabase();

            // Start server
            this.startServer(app);
        } catch (error) {
            logger.error('Application initialization failed:', error);
            process.exit(1);
        }
    }

    static forkWorkers() {
        const numCPUs = os.cpus().length;
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork();
        }

        cluster.on('exit', (worker, code, signal) => {
            logger.warn(`Worker ${worker.process.pid} died. Restarting...`);
            cluster.fork();
        });
    }

    static startServer(app) {
        const port = process.env.PORT || 8888;
        app.listen(port, () => {
            logger.info(
                `🏖️ 🔥 Worker ${process.pid} is listening on port ${port} 🏖️ 🔥 `
            );
        });
    }
}

// Start the application
Application.initialize().catch(error => {
    logger.error('Failed to start application:', error);
    process.exit(1);
});