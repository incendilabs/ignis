FROM node:24-alpine@sha256:fb71d01345f11b708a3553c66e7c74074f2d506400ea81973343d915cb64eef0 AS dev-deps
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine@sha256:fb71d01345f11b708a3553c66e7c74074f2d506400ea81973343d915cb64eef0 AS prod-deps
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine@sha256:fb71d01345f11b708a3553c66e7c74074f2d506400ea81973343d915cb64eef0 AS build
COPY . /app/
COPY --from=dev-deps /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine@sha256:fb71d01345f11b708a3553c66e7c74074f2d506400ea81973343d915cb64eef0
RUN apk add --no-cache wget
COPY --chown=node:node ./package.json package-lock.json /app/
COPY --chown=node:node --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/build /app/build
WORKDIR /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["npm", "run", "start"]
