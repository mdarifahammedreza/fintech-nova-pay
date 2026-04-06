# NovaPay — local development image (NestJS watch mode; not optimized for prod)
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install JS dependencies (devDependencies included for @nestjs/cli)
COPY package.json package-lock.json ./
RUN npm ci

# Build config and sources (bind-mount overwrites `src/` at runtime)
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

COPY docker/docker-entrypoint-dev.sh /usr/local/bin/docker-entrypoint-dev.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-dev.sh

EXPOSE 3002

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-dev.sh"]
CMD ["npm", "run", "start:dev"]
