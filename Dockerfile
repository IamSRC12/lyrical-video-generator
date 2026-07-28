FROM node:22-slim

# Install Chrome dependencies for Remotion
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV RENDER_CONCURRENCY=50%

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source
COPY . .

# Build Remotion bundle and Next.js
RUN npm run build

# Create data directories
RUN mkdir -p data/assets data/renders

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["npm", "start"]
