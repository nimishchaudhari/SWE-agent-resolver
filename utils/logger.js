/**
 * Simple Logger
 * Basic logging utilities without complex configuration
 */

const winston = require('winston');

// Simple log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
  })
);

// Create logger with console output
const logger = winston.createLogger({
  level: process.env.DEBUG_MODE === 'true' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Add simple file logging if in GitHub Actions
if (process.env.GITHUB_ACTIONS === 'true') {
  try {
    const logDir = process.env.RUNNER_TEMP || '/tmp';
    logger.add(new winston.transports.File({
      filename: `${logDir}/swe-agent.log`,
      format: logFormat
    }));
  } catch (error) {
    // Ignore file logging errors in GitHub Actions
    console.warn('File logging disabled:', error.message);
  }
}

module.exports = logger;