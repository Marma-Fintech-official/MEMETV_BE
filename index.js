const cluster = require('cluster')
const os = require('os')
const express = require('express')
const mongoose = require('mongoose')
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const TelegramBot = require('node-telegram-bot-api')
const logger = require('./src/helpers/logger') // Import the custom logger
require('dotenv').config()
const {generateUserJson} = require('./src/earlyEarnedrewards/storeEarlyReward');
const cron = require('node-cron') // Add cron for scheduling tasks
 // Set up routes
 const adminRouter = require('./src/admin/routes/allRoute')
 const passport = require("passport");
 const session = require("express-session");

 const rateLimit = require('express-rate-limit')
if (cluster.isMaster) {
  const token = process.env.TELEGRAM_TOKEN
  const bot = new TelegramBot(token);

  // Handle the /start command from Telegram
  bot.onText(/\/start(?:\s+(\w+))?/, (msg, match) => {
    const chatId = msg.chat.id
    const referredId = match[1]
    logger.info(`Received start command with referredId: ${referredId}`)

    bot
      .sendMessage(
        chatId,
        'Hello! Welcome to TheMemeTV: Watch TheMemeTV, play mini games, invite friends, unlock boosters, maintain streaks, earn points and stake your way to even more fun! Join now and turn your meme experience into something truly rewarding!',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '#doNothing',
                  web_app: {
                    url: `https://voluble-taiyaki-69f543.netlify.app/?start=${referredId}`
                  }
                }
              ],
              [
                {
                  text: 'Subscribe to the Channel',
                  url: 'https://t.me/thememetvcommunity' // Use the `url` property for links to external sites
                }
              ]
            ]
          }
        }
      )
      .catch(error => {
        logger.error(`Failed to send start message: ${error.message}`)
      })
  })

  const numCPUs = os.cpus().length

  //Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  const app = express()

  

  // Connect to MongoDB
  mongoose
    .connect(process.env.DBURL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000
    })
    .then(() => {
      logger.info(
        '*********🛡️ 🔍  Successfully Connected to MongoDB Stagging🛡️ 🔍 **********'
      )
    })
    .catch(err => {
      logger.error('MongoDB Connection Failure', err)
    })

  // Middleware setup
  app.use(cors())
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use(cookieParser())
  app.use(helmet())
  app.use(morgan('combined'))

  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',  // Use a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }  // Set secure: true if using HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());  // Enables persistent login sessions

  // Set up routes
  const router = require('./src/routes/allRoutes')
  app.use(router);
  
  app.use(adminRouter);


  app.get('/', (req, res) => {
    res.send(' ***🔥🔥 TheMemeTv Backend Server 2 is Running 🔥🔥*** ')
  })

  // Rate limiter
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000 // Limit each IP to 1000 requests per window
  })
  app.use(limiter);

  // Store a reference to the cron job
  const scheduledJob = cron.schedule('34 12 * * *', () => {
    logger.info('Running cron job to determine winners and lose...')
    generateUserJson();
  })

  // Stop the cron job after the end date
  const stopCronJob = async () => {
    const currentDate = new Date()
    const endDate = new Date('2025-02-02T23:59:59Z')

    if (currentDate > endDate) {
      scheduledJob.stop() // Stop the specific cron job
      logger.info('Cron job stopped as the end date has been reached.')
    }
  }

  // Call stopCronJob to check if it should stop (can be run on server startup)
  stopCronJob()

  const { encryptMessage } = require('./src/helpers/crypto')
   const {encryptedData,ivString } = encryptMessage(JSON.stringify({
       "name": "sefsge",
       "telegramId": "sefsge",
  }));
   console.log("encryptedData",encryptedData);
   console.log("ivString",ivString);

  // Listen on the specified port
  const port = process.env.PORT || 8888
  app.listen(port, '0.0.0.0', () => {
    logger.info(
      `🏖️ 🔥  Worker ${process.pid} is listening on port ${port} 🏖️ 🔥 `
    );
  });
}
