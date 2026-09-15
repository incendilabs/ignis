FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS dev-deps
WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci

FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS prod-deps
WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci --omit=dev

FROM --platform=$BUILDPLATFORM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS build
WORKDIR /app
COPY --from=dev-deps /app/node_modules /app/node_modules
COPY . /app/
# Get the collected docs
RUN mkdir -p /app/.lectio && npm run build

FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81
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
