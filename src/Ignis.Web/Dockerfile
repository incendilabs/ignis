FROM node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 AS dev-deps
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 AS prod-deps
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14 AS build
COPY . /app/
COPY --from=dev-deps /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine@sha256:2bdb65ed1dab192432bc31c95f94155ca5ad7fc1392fb7eb7526ab682fa5bf14
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
