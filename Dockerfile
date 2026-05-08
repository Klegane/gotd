FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install

FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG APP_URL=http://localhost:3000
ARG AUTH_SECRET=build-placeholder-secret-at-least-32-bytes
ARG GOOGLE_CLIENT_ID=build-placeholder-client-id
ARG GOOGLE_CLIENT_SECRET=build-placeholder-client-secret
ARG BGG_USERNAME=build-placeholder-bgg-user
ARG DATABASE_URL=file:./build.db
ARG APP_TIMEZONE=Europe/Madrid
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ENV APP_URL=$APP_URL
ENV NEXTAUTH_URL=$APP_URL
ENV AUTH_SECRET=$AUTH_SECRET
ENV NEXTAUTH_SECRET=$AUTH_SECRET
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
ENV BGG_USERNAME=$BGG_USERNAME
ENV DATABASE_URL=$DATABASE_URL
ENV APP_TIMEZONE=$APP_TIMEZONE
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache openssl wget && mkdir -p /data
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
