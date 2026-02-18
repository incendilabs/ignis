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

### Kubernetes

See the [infrastructure guide](infra/README.md) for testing Ignis on Kubernetes.
