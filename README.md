# Ignis
Explorative area for early-stage concepts and implementations for the [Spark FHIR Server](https://github.com/firelyteam/spark)

This repository exists to test concepts quickly, learn fast, and validate direction before committing to long-term
design decisions.

> [!IMPORTANT]
> Ignis is an experimental project for early-stage exploration. Thus, the implementations in this repository are not
> intended for production use.

## Getting Started

### MongoDB

Start a local MongoDB instance with Docker:

```bash
docker run -d --name ignis-mongo -p 127.0.0.1:27017:27017 mongo:8
```

Then run the API:

```bash
cd src/Ignis.Api
dotnet run
```

The API will be available at `https://localhost:5201/fhir` and the OpenAPI document at `https://localhost:5201/openapi/v1.json`.

### Local configuration

Copy `src/Ignis.Api/appsettings.local.example.json` to `src/Ignis.Api/appsettings.local.json` to apply per-developer overrides. The file is loaded only when the environment is `Development` and is gitignored.

### Kubernetes

See the [infrastructure guide](infra/README.md) for testing Ignis on Kubernetes.

## Production notes

### Structured JSON logging

The API logs to the console via Serilog. To emit one compact JSON object per log line (suitable for log aggregators), set:

```bash
Serilog__WriteTo__0__Name=Console
Serilog__WriteTo__0__Args__formatter=Serilog.Formatting.Compact.RenderedCompactJsonFormatter, Serilog.Formatting.Compact
```

These override the default console sink configured in `appsettings.json`.
