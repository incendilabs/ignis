# Ignis Helm Chart

## Configuration

### API (`app.api`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.api.replicaCount` | Number of API replicas | `1` |
| `app.api.image.repository` | API image repository | `ignis-api` |
| `app.api.image.tag` | API image tag | `latest` |
| `app.api.resources` | CPU/memory resource limits | See values.yaml |
| `app.api.sparkSettings.endpoint` | FHIR endpoint URL | `http://ignis-api:8080/fhir` |
| `app.api.sparkSettings.fhirRelease` | FHIR release version | `R4` |
| `app.api.externalMongodbConnectionString` | External MongoDB connection string | `""` |

### Web (`app.web`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.web.enabled` | Enable Web deployment | `true` |
| `app.web.replicaCount` | Number of Web replicas | `1` |
| `app.web.image.repository` | Web image repository | `ignis-web` |
| `app.web.image.tag` | Web image tag | `latest` |
| `app.web.resources` | CPU/memory resource limits | See values.yaml |

### Gateway API (`app.gateway`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.gateway.enabled` | Enable HTTPRoute resources | `true` |
| `app.gateway.name` | Name of the Gateway to attach to | `ignis-gateway` |
| `app.gateway.namespace` | Namespace of the Gateway | `""` |
| `app.gateway.hostname` | Hostname for routing | `""` |

### Traefik (`traefik`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `traefik.enabled` | Deploy Traefik with Gateway API support | `true` |
| `traefik.gateway.name` | Name of the Gateway resource Traefik creates | `ignis-gateway` |

See the [Traefik Helm chart](https://github.com/traefik/traefik-helm-chart) for all available Traefik parameters.

### MongoDB (`db`)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `db.enabled` | Enable MongoDB deployment | `true` |
| `db.image.repository` | MongoDB image repository | `mongo` |
| `db.image.tag` | MongoDB image tag | `8` |
| `db.auth.username` | MongoDB username | `ignis` |
| `db.auth.password` | MongoDB password (required when enabled) | `""` |
| `db.auth.database` | MongoDB database name | `ignis` |
| `db.auth.existingSecret` | Use existing Secret for credentials | `""` |
| `db.persistence.enabled` | Enable persistent storage | `true` |
| `db.persistence.size` | PVC size | `10Gi` |
| `db.persistence.storageClass` | Storage class | `""` |
| `db.resources` | CPU/memory resource limits | See values.yaml |
