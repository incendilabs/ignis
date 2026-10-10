/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { AddressInfo } from "node:net";
import path from "node:path";

import compression from "compression";
import express from "express";
import morgan from "morgan";
import type { ServerBuild } from "react-router";

import { parseAppUrl, pinOrigin } from "./origin.server.ts";

// Set before anything loads React: it picks its dev or production build on first import.
process.env.NODE_ENV ??= "production";
const { createRequestHandler } = await import("@react-router/express");
// A variable path: the build has no types and may not exist when type-checking.
const buildPath = "./build/server/index.js";
const build = (await import(buildPath)) as ServerBuild;

const appUrl = parseAppUrl(process.env.IGNIS_WEB_APP_URL);
const port = parsePort(process.env.PORT);
const publicPath = expressPath(build.publicPath);
const clientDir = path.resolve(import.meta.dirname, build.assetsBuildDirectory);

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(
  path.posix.join(publicPath, "assets"),
  express.static(path.join(clientDir, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(publicPath, express.static(clientDir));
app.use(morgan("tiny"));
app.all(
  "/{*splat}",
  pinOrigin(appUrl),
  createRequestHandler({ build, mode: process.env.NODE_ENV }),
);

const onListen = (error?: Error) => {
  if (error) throw error;
  const { port: boundPort } = server.address() as AddressInfo;
  console.log(
    `[ignis-web] listening on :${String(boundPort)} (${process.env.NODE_ENV ?? ""}) as ${appUrl.origin}`,
  );
};

const server = process.env.HOST
  ? app.listen(port, process.env.HOST, onListen)
  : app.listen(port, onListen);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close((error) => {
      if (error) console.error(error);
    });
    // Long-lived responses (the operations event stream) would hold the server open.
    setTimeout(() => {
      server.closeAllConnections();
    }, 5000).unref();
  });
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 3000;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`PORT must be an integer from 0 to 65535, got "${value}"`);
  }
  return parsed;
}

/** publicPath may be an absolute CDN URL; mount on its path, as react-router-serve does. */
function expressPath(publicPath: string): string {
  let pathname;
  try {
    pathname = new URL(publicPath).pathname;
  } catch {
    pathname = publicPath;
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
