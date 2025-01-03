# Use the official Node.js image as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Install PM2 globally
RUN npm install -g pm2

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 8888

# Start the application using PM2
CMD ["pm2-runtime", "start", "npm", "--name", "meme-tv", "--", "start"]

