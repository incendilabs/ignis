/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import path from "node:path";

import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";

process.env.NODE_ENV ??= "production";
const build = await import("./build/server/index.js");

// Express trust-proxy value: preset names and/or CIDRs. The defaults cover cluster pod networks.
const trustProxy =
  process.env.IGNIS_WEB_TRUST_PROXY || "loopback, linklocal, uniquelocal";
const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const publicPath = build.publicPath.replace(/\/+$/, "") || "/";
const clientDir = path.resolve(import.meta.dirname, build.assetsBuildDirectory);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", trustProxy);
app.use(compression());
app.use(
  path.posix.join(publicPath, "assets"),
  express.static(path.join(clientDir, "assets"), {
    immutable: true,
    maxAge: "1y",
  }),
);
app.use(publicPath, express.static(clientDir, { maxAge: "1h" }));
// express.static skips dotfiles, so mount .well-known explicitly.
app.use("/.well-known", express.static(path.join(clientDir, ".well-known")));
app.use(morgan("tiny"));
app.all(
  "/{*splat}",
  createRequestHandler({ build, mode: process.env.NODE_ENV }),
);

const onListen = () => {
  console.log(
    `[ignis-web] listening on :${port} (${process.env.NODE_ENV}, trust proxy: ${trustProxy})`,
  );
};

const server = process.env.HOST
  ? app.listen(port, process.env.HOST, onListen)
  : app.listen(port, onListen);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close(console.error));
}
