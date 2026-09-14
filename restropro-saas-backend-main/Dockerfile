FROM node:22-bookworm-slim

# Install system build dependencies for native modules (e.g. bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure upload and temp directories exist
RUN mkdir -p public tmp

EXPOSE 3000

CMD ["node", "index.js"]
