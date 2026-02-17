FROM node:24-alpine AS dev-deps
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS prod-deps
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build
COPY . /app/
COPY --from=dev-deps /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:24-alpine
COPY --chown=node:node ./package.json package-lock.json /app/
COPY --chown=node:node --from=prod-deps /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/build /app/build
WORKDIR /app
USER node
CMD ["npm", "run", "start"]
