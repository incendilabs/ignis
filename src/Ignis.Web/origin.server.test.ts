/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import http from "node:http";

import type { AddressInfo } from "node:net";

import { createRequestHandler } from "@react-router/express";
import express from "express";
import type { ServerBuild } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseAppUrl, pinOrigin } from "./origin.server.ts";

describe("parseAppUrl", () => {
  it.each([
    ["https://ignis.example.com", "https://ignis.example.com"],
    ["https://ignis.example.com/", "https://ignis.example.com"],
    ["https://ignis.example.com:443", "https://ignis.example.com"],
    ["https://Ignis.Example.com", "https://ignis.example.com"],
    ["http://localhost:3000", "http://localhost:3000"],
  ])("accepts %s", (value, origin) => {
    expect(parseAppUrl(value).origin).toBe(origin);
  });

  it.each([
    undefined,
    "",
    "ignis.example.com",
    "ftp://ignis.example.com",
    "https://ignis.example.com/app",
    "https://ignis.example.com?x=1",
    "https://user:pw@ignis.example.com",
    "http://[::1]:3000",
  ])("rejects %s", (value) => {
    expect(() => parseAppUrl(value)).toThrow();
  });
});

// Guards the pinning against changes in how @react-router/express builds request.url.
describe("pinOrigin with the React Router adapter", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const app = express();
    app.all(
      "/{*splat}",
      pinOrigin(parseAppUrl("https://ignis.example.com")),
      createRequestHandler({ build: echoBuild(), mode: "production" }),
    );
    server = await new Promise<http.Server>((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => {
        resolve(listening);
      });
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(() => {
    server.close();
  });

  it.each([
    ["no proxy headers", {}],
    ["Host rewritten by the proxy", { Host: "ignis-web:3000" }],
    ["spoofed Host", { Host: "evil.example:4444" }],
    [
      "spoofed forwarded headers",
      { "X-Forwarded-Host": "evil.example:4444", "X-Forwarded-Proto": "http" },
    ],
    ["forwarded-host chain", { "X-Forwarded-Host": "ignis.example.com, internal:3000" }],
  ])("sees the app origin with %s", async (_name, headers) => {
    const response = await send({ path: "/echo?x=1", headers });

    expect(response.body).toBe("https://ignis.example.com/echo?x=1");
  });

  it("accepts an action from the app origin behind a TLS proxy", async () => {
    const response = await send({
      method: "POST",
      path: "/echo.data",
      headers: { Origin: "https://ignis.example.com", "X-Forwarded-Proto": "https" },
    });

    expect(response.status).toBe(200);
  });

  it("rejects an action from another origin, even with a matching spoofed Host", async () => {
    const response = await send({
      method: "POST",
      path: "/echo.data",
      headers: { Origin: "https://evil.example", Host: "evil.example" },
    });

    expect(response.status).toBe(400);
  });

  it("drops forwarded headers before the app sees them", async () => {
    const response = await send({
      path: "/headers",
      headers: { "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http", Forwarded: "host=evil.example" },
    });

    expect(response.body).toBe("ignis.example.com,,,");
  });

  it("rejects an absolute-form request target", async () => {
    const response = await send({ path: "http://evil.example/echo" });

    expect(response.status).toBe(400);
  });

  /** node:http rather than fetch, which won't send a custom Host header. */
  function send({
    method = "GET",
    path,
    headers = {},
  }: {
    method?: string;
    path: string;
    headers?: Record<string, string>;
  }): Promise<{ status: number | undefined; body: string }> {
    return new Promise((resolve, reject) => {
      const request = http.request(
        { host: "127.0.0.1", port, method, path, headers },
        (response) => {
          let body = "";
          response.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          response.on("end", () => {
            resolve({ status: response.statusCode, body });
          });
        },
      );
      request.on("error", reject);
      request.end();
    });
  }
});

/** A minimal server build: one route whose loader echoes the URL the app sees. */
function echoBuild(): ServerBuild {
  const echo = {
    loader: ({ request }: { request: Request }) => new Response(request.url),
    action: () => ({ ok: true }),
  };
  const headers = {
    loader: ({ request }: { request: Request }) =>
      new Response(
        ["host", "x-forwarded-host", "x-forwarded-proto", "forwarded"]
          .map((name) => request.headers.get(name) ?? "")
          .join(","),
      ),
  };
  return {
    entry: { module: { default: () => new Response("unused") } },
    routes: {
      echo: { id: "echo", path: "echo", module: echo },
      headers: { id: "headers", path: "headers", module: headers },
    },
    assets: {
      entry: { imports: [], module: "" },
      routes: {},
      url: "",
      version: "test",
    },
    assetsBuildDirectory: "",
    publicPath: "/",
    basename: "/",
    future: {},
    ssr: true,
    isSpaMode: false,
    prerender: [],
    routeDiscovery: { mode: "lazy", manifestPath: "/__manifest" },
    allowedActionOrigins: [],
  } as unknown as ServerBuild;
}
