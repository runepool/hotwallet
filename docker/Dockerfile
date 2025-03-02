FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the exchange application
RUN yarn build:exchange

# Expose the exchange API port
EXPOSE 3001
