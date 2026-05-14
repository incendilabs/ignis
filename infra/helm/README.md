# Ignis Helm Chart

## Configuration

### API (`app.api`)

| Parameter                                 | Description                                           | Default                      |
| ----------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| `app.api.replicaCount`                    | Number of API replicas                                | `1`                          |
| `app.api.image.repository`                | API image repository                                  | `ignis-api`                  |
| `app.api.image.tag`                       | API image tag                                         | `latest`                     |
| `app.api.resources`                       | CPU/memory resource limits                            | See values.yaml              |
| `app.api.hostnames`                       | Hostnames for API HTTPRoute; empty disables the route | `[]`                         |
| `app.api.sparkSettings.endpoint`          | FHIR endpoint URL                                     | `http://ignis-api:8080/fhir` |
| `app.api.sparkSettings.fhirRelease`       | FHIR release version                                  | `R4`                         |
| `app.api.externalMongodbConnectionString` | External MongoDB connection string                    | `""`                         |
| `app.api.existingSecret`                  | Use existing Secret (skips chart-managed secret)      | `""`                         |
| `app.api.podAnnotations`                  | Annotations applied to the api pod template           | `{}`                         |

### Web (`app.web`)

| Parameter                  | Description                                           | Default         |
| -------------------------- | ----------------------------------------------------- | --------------- |
| `app.web.enabled`          | Enable Web deployment                                 | `true`          |
| `app.web.replicaCount`     | Number of Web replicas                                | `1`             |
| `app.web.image.repository` | Web image repository                                  | `ignis-web`     |
| `app.web.image.tag`        | Web image tag                                         | `latest`        |
| `app.web.resources`        | CPU/memory resource limits                            | See values.yaml |
| `app.web.hostnames`        | Hostnames for Web HTTPRoute; empty disables the route | `[]`            |
| `app.web.existingSecrets`  | Names of Secrets mounted as env vars via `envFrom`    | `[]`            |
| `app.web.extraEnv`         | Extra `{name, value}` env entries set inline          | `[]`            |
| `app.web.podAnnotations`   | Annotations applied to the web pod template           | `{}`            |

The Web BFF reads all its configuration from environment variables. Wire credentials through `existingSecrets`; pass non-secret feature flags through `extraEnv`:

```bash
kubectl create secret generic ignis-web-oauth \
  --from-literal=IGNIS_WEB_CLIENT_ID=ignis-web \
  --from-literal=IGNIS_WEB_CLIENT_SECRET=... \
  --from-literal=IGNIS_WEB_SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=IGNIS_AUTH_ISSUER=https://api.example.com \
  --from-literal=IGNIS_WEB_APP_URL=https://ignis.example.com

helm install ignis infra/helm \
  --set db.auth.password="$MONGO_PASSWORD" \
  --set 'app.web.existingSecrets[0]=ignis-web-oauth' \
  --set 'app.web.extraEnv[0].name=IGNIS_WEB_FEATURES_AUTH' \
  --set-string 'app.web.extraEnv[0].value=true' \
  --set 'app.web.extraEnv[1].name=IGNIS_WEB_FEATURES_ADMIN' \
  --set-string 'app.web.extraEnv[1].value=true'
```

Multiple Secrets are supported (e.g. one synced by External Secrets, one with the session key) — list them all under `existingSecrets`.

### Gateway API (`app.gateway`)

| Parameter               | Description                                                         | Default         |
| ----------------------- | ------------------------------------------------------------------- | --------------- |
| `app.gateway.enabled`   | Enable HTTPRoute resources for components with hostnames configured | `true`          |
| `app.gateway.name`      | Name of the Gateway to attach to                                    | `ignis-gateway` |
| `app.gateway.namespace` | Namespace of the Gateway                                            | `""`            |

### Traefik (`traefik`)

| Parameter              | Description                                  | Default         |
| ---------------------- | -------------------------------------------- | --------------- |
| `traefik.enabled`      | Deploy Traefik with Gateway API support      | `true`          |
| `traefik.gateway.name` | Name of the Gateway resource Traefik creates | `ignis-gateway` |

See the [Traefik Helm chart](https://github.com/traefik/traefik-helm-chart) for all available Traefik parameters.

### MongoDB (`db`)

| Parameter                     | Description                              | Default         |
| ----------------------------- | ---------------------------------------- | --------------- |
| `db.enabled`                  | Enable MongoDB deployment                | `true`          |
| `db.image.repository`         | MongoDB image repository                 | `mongo`         |
| `db.image.tag`                | MongoDB image tag                        | `8`             |
| `db.auth.username`            | MongoDB username                         | `ignis`         |
| `db.auth.password`            | MongoDB password (required when enabled) | `""`            |
| `db.auth.database`            | MongoDB database name                    | `ignis`         |
| `db.auth.existingSecret`      | Use existing Secret for credentials      | `""`            |
| `db.persistence.enabled`      | Enable persistent storage                | `true`          |
| `db.persistence.size`         | PVC size                                 | `10Gi`          |
| `db.persistence.storageClass` | Storage class                            | `""`            |
| `db.resources`                | CPU/memory resource limits               | See values.yaml |
