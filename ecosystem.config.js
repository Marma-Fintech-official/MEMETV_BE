require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'meme-tv',
      script: 'index.js',
      instances: 'max',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'testnet',
        DBURL: process.env.DBURL,
        PORT: process.env.PORT,
        TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
      },
      log_type: "raw",
    },
  ],
};