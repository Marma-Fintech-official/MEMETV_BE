const Vote = require('../models/userVoteModel')
const User = require('../models/userModel')
const logger = require('../helpers/logger')

const getBattleByDate = async (req, res, next) => {
  let date

  try {
    date = req.query.date

    if (!date) {
      return res
        .status(400)
        .json({ message: 'Date query parameter is required' })
    }

    // Log the incoming request
    logger.info(`Received request for battles on date: ${date}`)

    // Try to parse the date properly
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      logger.warn(`Invalid date format received: ${date}`)
      return res.status(400).json({ message: 'Invalid date format' })
    }

    // Convert the parsed date to the start and end of the day in UTC
    const startOfDay = new Date(parsedDate)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(parsedDate)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Query the database to get battles for the provided date
    const battles = await Vote.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })

    // If no battles found
    if (battles.length === 0) {
      logger.warn(`No battles found for the date: ${date}`)
      return res
        .status(404)
        .json({ message: 'No battles found for the given date' })
    }

    // Initialize winCounts and lossCounts
    const winCounts = {}
    const lossCounts = {}

    // Get unique team IDs for counting wins and losses
    const teamIds = [
      ...new Set(battles.flatMap(battle => [battle.winner, battle.lose]))
    ]

    // Count wins for each teamId
    const winResults = await Vote.aggregate([
      {
        $match: {
          winner: { $in: teamIds }
        }
      },
      {
        $group: {
          _id: '$winner',
          count: { $sum: 1 }
        }
      }
    ])

    // Store win counts
    winResults.forEach(result => {
      winCounts[result._id] = result.count
    })

    // Count losses for each teamId
    const lossResults = await Vote.aggregate([
      {
        $match: {
          lose: { $in: teamIds }
        }
      },
      {
        $group: {
          _id: '$lose',
          count: { $sum: 1 }
        }
      }
    ])

    // Store loss counts
    lossResults.forEach(result => {
      lossCounts[result._id] = result.count
    })

    // Now, aggregate total votes for all teams in the Vote model
    const totalVotesResults = await Vote.aggregate([
      {
        $unwind: '$teams'
      },
      {
        $group: {
          _id: '$teams.teamId',
          totalVotes: {
            $sum: {
              $cond: [
                { $eq: ['$teams.teamVotes', ''] }, // Check if teamVotes is an empty string
                0, // If true, treat as 0
                { $toInt: '$teams.teamVotes' } // Otherwise, convert to integer
              ]
            }
          }
        }
      }
    ])

    // Create a map to store total votes for each teamId
    const teamVotesMap = {}
    totalVotesResults.forEach(result => {
      teamVotesMap[result._id] = result.totalVotes
    })

    // Convert the map to an array of [teamId, totalVotes] pairs
    const teamVotesArray = Object.entries(teamVotesMap).map(
      ([teamId, totalVotes]) => ({
        teamId,
        totalVotes
      })
    )

    // Sort teams by totalVotes in descending order
    teamVotesArray.sort((a, b) => b.totalVotes - a.totalVotes)

    // Assign ranks
    const rankMap = {}
    teamVotesArray.forEach((team, index) => {
      rankMap[team.teamId] = index + 1 // Rank starts at 1
    })

    // Prepare the response array with win and loss counts
    const response = battles.map(battle => ({
      _id: battle._id,
      teams: battle.teams.map(team => ({
        _id: team._id,
        teamName: team.teamName,
        teamId: team.teamId,
        rank: rankMap[team.teamId] || 0, // Use rank from the map
        wins: winCounts[team.teamId] || 0,
        losses: lossCounts[team.teamId] || 0
      })),
      date: battle.date
    }))

    // Log successful query
    logger.info(`Battles found for date: ${date}, sending response.`)

    // Send the found battles back
    res.json(response)
  } catch (err) {
    next(err)
  }
}

const getTeamVotesByDate = async (req, res, next) => {
  try {
    // Get the current date
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(today)
    endOfDay.setUTCHours(23, 59, 59, 999)

    // Query the database for today's battles
    const battles = await Vote.find(
      {
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      },
      {
        'teams.teamVotes': 1,
        'teams.teamId': 1,
        'teams.teamName': 1,
        date: 1
      }
    )

    // Extract only teamVotes, teamId, and date into an array
    const responseData = battles.map(battle => ({
      date: battle.date,
      teams: battle.teams.map(team => ({
        teamId: team.teamId,
        teamName: team?.teamName,
        teamVotes: team.teamVotes
      }))
    }))

    // Send the formatted response
    res.status(200).json(responseData)
  } catch (err) {
    next(err)
    logger.error(`Error ${err.message}`)
  }
}

const userChooseTeam = async (req, res, next) => {
  const { teamId, telegramId } = req.body

  try {
    // Get today's date (in UTC) to find the appropriate battle
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0) // Set to the start of the day in UTC

    // Find the vote document for today
    const vote = await Vote.findOne({
      date: {
        $gte: today,
        $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      }
    })

    // If no battle is found for today, return an error
    if (!vote) {
      return res.status(404).json({ message: 'No battles available for today' })
    }

    // Check if the user has already voted today across all teams
    const hasAlreadyVoted = vote.teams.some(team =>
      team.votersIds.some(voter => voter.telegramId === telegramId)
    )

    if (hasAlreadyVoted) {
      return res.status(400).json({ message: 'You have already chosen today' })
    }

    // Find the team the user wants to vote for
    const team = vote.teams.find(team => team.teamId === teamId)

    if (!team) {
      return res
        .status(404)
        .json({ message: "Team not found for today's battle" })
    }

    // Add the user to the votersIds array for the selected team
    team.votersIds.push({ telegramId, createdAt: new Date() })

    // Find the user by telegramId
    const user = await User.findOne({ telegramId })

    // Check if the user exists
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Preserve existing battleReward and update only relevant properties
    const currentBattleReward = user.voteDetails.battleReward || 0 // Preserve the existing battleReward

    user.voteDetails = {
      ...user.voteDetails, // Preserve existing voteDetails fields
      votingTeamId: teamId,
      voteStatus: true,
      voteDate: new Date(),
      battleReward: currentBattleReward // Ensure battleReward is preserved
    }

    // Save the updated user
    await user.save()

    // Save the updated vote document
    await vote.save()

    // Log the successful update
    logger.info(
      `User with telegramId ${telegramId} successfully chose team ${teamId}`
    )

    // Respond with success message
    return res.status(200).json({ message: 'Team successfully chosen', vote })
  } catch (err) {
    next(err)
    logger.error(
      `Error choosing team for telegramId ${telegramId}: ${err.message}`
    )
  }
}

module.exports = {
  getBattleByDate,
  userChooseTeam,
  getTeamVotesByDate
}
