FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS dev-deps
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS prod-deps
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
COPY . /app/
COPY --from=dev-deps /app/node_modules /app/node_modules
WORKDIR /app
# Get the collected docs 
RUN mkdir -p /app/.lectio && npm run build

FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
RUN apk add --no-cache wget
COPY --chown=node:node ./package.json package-lock.json /app/
COPY --chown=node:node --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/build /app/build
COPY --chown=node:node --from=build /app/.lectio /app/.lectio
WORKDIR /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["npm", "run", "start"]
