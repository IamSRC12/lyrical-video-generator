FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Download the Remotion-pinned browser during image build.
RUN npx remotion browser ensure

COPY . .

RUN npm run build

RUN mkdir -p /app/data/assets /app/data/renders

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV RENDER_BASE_URL=http://127.0.0.1:3000
ENV RENDER_CONCURRENCY=25%

EXPOSE 3000

CMD ["npm", "start"]
