const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf, colorize } = format

const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`
})

const logger = createLogger({
  format: combine(colorize(), timestamp(), customFormat),
  transports: [new transports.Console()]
})

module.exports = logger
