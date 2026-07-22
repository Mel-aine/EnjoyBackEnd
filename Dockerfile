FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333
ENV RUN_MIGRATIONS=true

COPY --from=builder /app/build /app
COPY --from=builder /app/package-lock.json /app/package-lock.json

RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

EXPOSE 3333

CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then node ace.js migration:run --force; fi && node bin/server.js"]
