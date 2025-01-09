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
const rateLimit = require('express-rate-limit')
// const { encryptMessage } = require('./src/helpers/crypto')
if (cluster.isMaster) {
  const token = process.env.TELEGRAM_TOKEN
  const bot = new TelegramBot(token, { polling: true })

  // Handle the /start command from Telegram
  bot.onText(/\/start(?:\s+(\w+))?/, (msg, match) => {
    const chatId = msg.chat.id
    const referredId = match[1]
    logger.info(`Received start command with referredId: ${referredId}`)
    bot.sendMessage(
      chatId,
      'Hello! Welcome to The Meme TV: Watch videos, play games, invite friends, and earn points. Boost rewards and stake your way to even more fun! Join now and turn your meme experience into something truly rewarding!',
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '#doNothings',
                web_app: {
                  url: `https://radiant-salamander-b1182a.netlify.app/?start=${referredId}`
                }
              }
            ]
          ]
        }
      }
    )
  })

  const numCPUs = os.cpus().length

  //Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  const app = express()
  //     const  {encryptedData,ivString } = encryptMessage(JSON.stringify({
  //       "telegramId": "5794983263",
  //       "gamePoints": "2000",
  //       "boosters": ["2x", "2x", "3x", "3x"]
  // }));
  //   console.log("encryptedData",encryptedData);
  //   console.log("ivString",ivString);

  // Connect to MongoDB
  mongoose
    .connect(process.env.DBURL, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    })
    .then(() => {
      logger.info(
        '*********🛡️ 🔍  Successfully Connected to MongoDB 🛡️ 🔍 **********'
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

  // Set up routes
  const router = require('./src/routes/allRoutes')
  app.use(router)

  app.get('/', (req, res) => {
    res.send(' ***🔥🔥 TheMemeTv Backend Server 2 is Running 🔥🔥*** ')
  })

  // Rate limiter
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000 // Limit each IP to 1000 requests per window
  })
  app.use(limiter)

  // Listen on the specified port
  const port = process.env.PORT || 8888
  app.listen(port, '0.0.0.0', () => {
    logger.info(
      `🏖️ 🔥  Worker ${process.pid} is listening on port ${port} 🏖️ 🔥 `
    )
  })
}
