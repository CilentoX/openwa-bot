FROM node:20-alpine

# Install build dependencies for sqlite3 if compiling from source on alpine
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY . .

# Expose bot port
EXPOSE 3000

# Run entry point
CMD ["node", "bot.js"]
