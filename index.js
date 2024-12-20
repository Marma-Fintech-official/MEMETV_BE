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
const Vote = require('./src/models/userVoteModel')
const User = require('./src/models/userModel')
const cron = require('node-cron') // Add cron for scheduling tasks
require('dotenv').config()
const http = require('http') // Add http server
const WebSocket = require('ws') // Add WebSocket
const rateLimit = require('express-rate-limit')
const { createProxyMiddleware } = require('http-proxy-middleware')
if (cluster.isMaster) {
  const token = process.env.TELEGRAM_TOKEN
  const bot = new TelegramBot(token,{polling: true})

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
                text: '#doNothing',
                web_app: {
                  url: `https://zippy-smakager-45b1ee.netlify.app/?start=${referredId}`
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

  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://api.thememe.tv',
      changeOrigin: true
    })
  )

  app.get('/', (req, res) => {
    res.send(' ***🔥🔥 TheMemeTv Backend Server is Running 🔥🔥*** ')
  })

  // Rate limiter
  const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000 // Limit each IP to 1000 requests per window
  })
  app.use(limiter)

  // Create HTTP server to handle both HTTP and WebSocket traffic
  const server = http.createServer(app)

  // WebSocket setup
  const wsPort = process.env.WS_PORT || 3000
  const wsServer = new WebSocket.Server({ server })

  let activeUsers = 0

  wsServer.on('connection', ws => {
    activeUsers++
    broadcastActiveUsers()

    ws.on('close', () => {
      activeUsers--
      broadcastActiveUsers()
    })
  })

  function broadcastActiveUsers () {
    wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ activeUsers }))
      }
    })
  }

  // Log WebSocket server status
  logger.info(`WebSocket server is running on port ${wsPort}`)

  let isProcessing = false // A flag to indicate if the job is currently processing

  const determineWinnersAndLosers = async () => {
    if (isProcessing) {
      logger.info(
        'The job is already running. Exiting to prevent duplicate execution.'
      )
      return
    }

    isProcessing = true

    const battleRewards = 1000 // Total battle rewards
    try {
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0) // Set to midnight UTC
      const endOfDay = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)

      const vote = await Vote.findOne({
        date: { $gte: today, $lte: endOfDay }
      })

      if (!vote) {
        logger.warn('No battles available for today')
        isProcessing = false
        return
      }

      if (vote.rewardsDistributed) {
        logger.info('Rewards have already been distributed for today.')
        isProcessing = false
        return
      }

      const teamVotes = vote.teams.map(team => ({
        teamId: team.teamId,
        teamVotes: team.votersIds.reduce(
          (total, voter) => total + (parseInt(voter.yourVotes) || 0),
          0
        ),
        votersIds: team.votersIds
      }))

      const winner = teamVotes.reduce((prev, current) =>
        prev.teamVotes > current.teamVotes ? prev : current
      )
      const lose = teamVotes.reduce((prev, current) =>
        prev.teamVotes < current.teamVotes ? prev : current
      )

      vote.winner = winner.teamId
      vote.lose = lose.teamId

      const processedUsers = new Set()

      await Promise.all(
        winner.votersIds.map(async voter => {
          const user = await User.findOne({ telegramId: voter.telegramId })

          if (!user || processedUsers.has(user.telegramId)) return

          processedUsers.add(user.telegramId)

          const userVoteProportion =
            parseInt(voter.yourVotes) / winner.teamVotes
          let battleReward = Math.round(battleRewards * userVoteProportion)

          user.voteDetails.battleReward += battleReward
          user.totalRewards += battleReward

          const todayKey = new Date().toISOString().slice(0, 10)

          let existingDailyReward = user.dailyRewards.find(
            reward => reward.createdAt.toISOString().slice(0, 10) === todayKey
          )

          if (existingDailyReward) {
            existingDailyReward.totalRewards += battleReward
          } else {
            user.dailyRewards.push({
              userId: user._id,
              telegramId: user.telegramId,
              totalRewards: battleReward,
              userStaking: false,
              createdAt: new Date()
            })
          }

          // After updating battle rewards, check if user levels up
          const newLevelInfo = updateLevel(user, todayKey)

          // Log level-up details if any
          if (newLevelInfo.levelUpOccurred) {
            logger.info(
              `User ${user.telegramId} leveled up to level ${user.level}, received level-up bonus of ${newLevelInfo.bonusPoints}`
            )
          }

          await user.save()
        })
      )

      vote.rewardsDistributed = true
      await vote.save()

      logger.info(
        `Updated vote document ${vote._id} with winner ${vote.winner} and lose ${vote.lose}`
      )
    } catch (err) {
      logger.error(`Error calculating battle reward: ${err.message}`)
    } finally {
      isProcessing = false
    }
  }

  const thresholds = [
    { limit: 500, level: 1 },
    { limit: 10000, level: 2 },
    { limit: 50000, level: 3 },
    { limit: 200000, level: 4 },
    { limit: 800000, level: 5 },
    { limit: 3000000, level: 6 },
    { limit: 10000000, level: 7 },
    { limit: 25000000, level: 8 },
    { limit: 50000000, level: 9 },
    { limit: 80000000, level: 10 }
  ]

  const levelUpBonuses = [
    1000, // Level 2 to Level 3
    10000, // Level 3 to Level 4
    50000, // Level 4 to Level 5
    100000, // Level 5 to Level 6
    500000, // Level 6 to Level 7
    1000000, // Level 7 to Level 8
    5000000, // Level 8 to Level 9
    10000000, // Level 9 to Level 10
    20000000 // Level 10 and above
  ]

  // Update level function
  const updateLevel = (user, currentDateString) => {
    let currentLevel = user.level || 1
    let newLevel = currentLevel
    let newLevelUpPoints = 0
    let levelUpOccurred = false

    for (const threshold of thresholds) {
      if (user.totalRewards >= threshold.limit) {
        newLevel = threshold.level
      } else {
        break
      }
    }

    if (newLevel > currentLevel) {
      for (let i = currentLevel; i < newLevel; i++) {
        newLevelUpPoints += levelUpBonuses[i - 1]
      }
      user.totalRewards += newLevelUpPoints
      user.levelUpRewards += newLevelUpPoints
      user.level = newLevel
      levelUpOccurred = true
    }

    if (newLevelUpPoints > 0) {
      const today = new Date(currentDateString)
      today.setUTCHours(0, 0, 0, 0)

      let dailyReward = user.dailyRewards.find(dr => {
        const rewardDate = new Date(dr.createdAt)
        rewardDate.setUTCHours(0, 0, 0, 0)
        return rewardDate.getTime() === today.getTime()
      })

      if (dailyReward) {
        dailyReward.totalRewards += newLevelUpPoints
      } else {
        user.dailyRewards.push({
          userId: user._id,
          telegramId: user.telegramId,
          totalRewards: newLevelUpPoints,
          userStaking: false,
          createdAt: today
        })
      }
    }

    return { levelUpOccurred, bonusPoints: newLevelUpPoints }
  }

  // Store a reference to the cron job
  const scheduledJob = cron.schedule('36 14 * * *', () => {
    logger.info('Running cron job to determine winners and lose...')
    determineWinnersAndLosers()
  })

  // Stop the cron job after the end date
  const stopCronJob = async () => {
    const currentDate = new Date()
    const endDate = new Date('2024-10-10T23:59:59Z')

    if (currentDate > endDate) {
      scheduledJob.stop() // Stop the specific cron job
      logger.info('Cron job stopped as the end date has been reached.')
    }
  }

  // Call stopCronJob to check if it should stop (can be run on server startup)
  stopCronJob()

  // Listen on the specified port
  const port = process.env.PORT || 8888
  server.listen(port, () => {
    logger.info(
      `🏖️ 🔥  Worker ${process.pid} is listening on port ${port} 🏖️ 🔥 `
    )
  })
}