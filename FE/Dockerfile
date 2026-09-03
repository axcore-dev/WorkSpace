# syntax=docker/dockerfile:1

# Next.js 16 (App Router) 실행용. nginx 는 넣지 않는다 — Next 는 자체 Node 서버로 서빙하고,
# 리버스 프록시는 INFRA/nginx 컨테이너가 맡는다.
#
# NEXT_PUBLIC_* 는 빌드 시점에 번들에 박히므로 ARG 로 받는다. 값은 INFRA/.env 에서
# docker-compose.yml 의 build.args 로 들어온다. .env 파일 자체는 .dockerignore 로 막는다.

# --- deps ------------------------------------------------------------------
# package-lock.json 기준으로 정확히 설치한다. 이 레이어는 lock 이 안 바뀌면 캐시된다.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- build -----------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# nginx 뒤에서 FE 와 API 가 같은 오리진이면 빈 문자열이 맞다 → fetch("/api/...").
# 빈 문자열은 `??` 기본값(localhost:8080)을 밟지 않는다.
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ARG NEXT_PUBLIC_NAVER_CLIENT_ID=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_NAVER_CLIENT_ID=$NEXT_PUBLIC_NAVER_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1

# next.config.ts 의 output: "standalone" 이 .next/standalone 에 자체 실행 가능한 서버를 만든다.
RUN npm run build

# --- runtime ---------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# root 로 실행하지 않는다.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# standalone 은 public 과 .next/static 을 포함하지 않으므로 따로 복사한다.
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8000
CMD ["node", "server.js"]
