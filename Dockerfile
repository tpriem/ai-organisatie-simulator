# The web app (web/) imports CLI modules from ../src, so the build context
# is the repo root, not web/ — both package.json's need to be installed.
FROM node:22-bookworm-slim

# Use Debian's Chromium instead of Puppeteer's bundled download: the bundled
# Chrome-for-Testing build is x86_64-only, which breaks on arm64 hosts.
# Chromium's apt package pulls in all the shared libs it needs on its own.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Root (CLI) dependencies — required at runtime by web/app's ../src imports.
COPY package.json package-lock.json ./
RUN npm ci

# Web app dependencies (devDependencies included: Tailwind is needed at build time).
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci

COPY src ./src
COPY web ./web

RUN npm --prefix web run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/web
CMD ["npm", "start"]
