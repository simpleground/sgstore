# Simple Ground — image aplikasi (Next.js + migrasi database).
#
#   docker build -t sgstore --build-arg SITE_URL=https://simpleground.online .
#   docker run --env-file .env -p 3000:3000 -v sgstore-storage:/app/storage sgstore
#
# SITE_URL dan NEXT_PUBLIC_GOOGLE_CLIENT_ID dibaca saat build (sama seperti
# `npm run build` di VPS), jadi berikan sebagai --build-arg.
# Variabel lain (DATABASE_URL, kunci Midtrans/Biteship, dll.) diberikan saat run.
# MIGRATE_ON_START=true menjalankan `db/migrations` sebelum server menyala.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ARG SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV SITE_URL=$SITE_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    STORAGE_LOCAL_DIR=/app/storage
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/db/migrations ./db/migrations
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
VOLUME ["/app/storage"]
CMD ["sh", "-c", "if [ \"$MIGRATE_ON_START\" = true ]; then node scripts/migrate.mjs || exit 1; fi; exec node node_modules/next/dist/bin/next start -p \"${PORT:-3000}\" -H 0.0.0.0"]
