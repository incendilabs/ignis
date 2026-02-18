# Ignis Infrastructure

Kubernetes deployment for the Ignis FHIR Server using Helm. This chart allows you to deploy the API, Web frontend, and MongoDB database with configurable options for development and production environments. It also includes an optional Traefik reverse proxy for routing and TLS termination.

> [!IMPORTANT]
> Ignis k8s is an experimental deployment setup for early-stage exploration. Thus, the implementations in this repository are not
> intended for production use.

## Prerequisites

- [Helm](https://helm.sh/docs/intro/install/) v3+
- A Kubernetes cluster (e.g. [k3d](https://k3d.io/) for local development)
- Container images for `ignis-api` and `ignis-web`
- [cert-manager](https://cert-manager.io/docs/installation/) with a `ClusterIssuer` (only required for TLS)

## Quick Start

```bash
# Create a local k3d cluster
k3d cluster create ignis

# Build and import images
docker build -t ignis-api:latest -f src/Ignis.Api/Dockerfile src/Ignis.Api/
docker build -t ignis-web:latest -f src/Ignis.Web/Dockerfile src/Ignis.Web/
k3d image import ignis-api:latest ignis-web:latest -c ignis

# Download chart dependencies (Traefik etc.)
helm dependency update infra/helm

# Generate a MongoDB password and install
export MONGO_PASSWORD=$(openssl rand -hex 32)

helm install ignis infra/helm \
  --set db.auth.password="$MONGO_PASSWORD"

# Access the API
kubectl port-forward svc/ignis-api 8080:8080
# Visit http://localhost:8080/fhir
```

## Components

The chart is organized as sub-charts:

| Sub-chart | Description | Default |
|-----------|-------------|---------|
| `app` | Ignis.Api and Ignis.Web deployments | Both on |
| `db` | MongoDB StatefulSet | On |
| `traefik` | Traefik reverse proxy with Gateway API | On |

## Local Development

Run only MongoDB in Kubernetes, and the API locally with `dotnet run`:

```bash
helm dependency update infra/helm
export MONGO_PASSWORD=$(openssl rand -hex 32)

# Install with API and Web disabled (only MongoDB + Traefik)
helm install ignis infra/helm \
  --set db.auth.password="$MONGO_PASSWORD" \
  --set app.api.replicaCount=0 \
  --set app.web.enabled=false

# Port-forward MongoDB
kubectl port-forward svc/ignis-mongodb 27017:27017

# Run the API locally (retrieve the connection string from the secret)
cd src/Ignis.Api
StoreSettings__ConnectionString=$(kubectl get secret ignis-api -o jsonpath='{.data.StoreSettings__ConnectionString}' | base64 -d) dotnet run
```

## External MongoDB

Use an existing MongoDB instance instead of deploying one:

```bash
helm install ignis infra/helm \
  --set db.enabled=false \
  --set app.api.externalMongodbConnectionString="mongodb://user:pass@mongo-host:27017/ignis?authSource=admin"
```

## Existing Traefik

If your cluster already has Traefik installed, disable the bundled one and point the HTTPRoutes at the existing Gateway:

```bash
helm install ignis infra/helm \
  --set db.auth.password="$MONGO_PASSWORD" \
  --set traefik.enabled=false \
  --set app.gateway.name=traefik-gateway \
  --set app.gateway.namespace=traefik
```

## Hostnames

API and Web require separate hostnames to avoid routing conflicts. Pass them as lists:

```bash
helm install ignis infra/helm \
  --set db.auth.password="$MONGO_PASSWORD" \
  --set 'app.api.hostnames[0]=api.ignis.example.com' \
  --set 'app.web.hostnames[0]=ignis.example.com'
```

Multiple hostnames per service are supported:

```bash
--set 'app.web.hostnames[0]=ignis.example.com' \
--set 'app.web.hostnames[1]=ignis.example.org'
```

## TLS

TLS termination is handled by the Gateway using certificates issued by [cert-manager](https://cert-manager.io/docs/installation/). The chart does not install cert-manager — it expects a `ClusterIssuer` to already exist in the cluster.

### 1. Install cert-manager (if not already installed)

```bash
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
```

### 2. Create a ClusterIssuer

For HTTP-01 (simplest — works with any DNS provider):

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    email: you@example.com
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-key
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs:
              - name: ignis-gateway
```

> [!TIP]
> Use `https://acme-staging-v02.api.letsencrypt.org/directory` as server while testing to avoid rate limits.

### 3. Create a Certificate

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ignis-tls
  namespace: ignis
spec:
  secretName: ignis-tls
  issuerRef:
    name: letsencrypt
    kind: ClusterIssuer
  dnsNames:
    - ignis.example.com
    - api.ignis.example.com
```

### 4. Add HTTPS listeners to the Gateway

Add a listener for each hostname on the Gateway, referencing the TLS secret:

```yaml
listeners:
  - name: https-ignis
    port: 8443
    protocol: HTTPS
    hostname: ignis.example.com
    allowedRoutes:
      namespaces:
        from: All
    tls:
      mode: Terminate
      certificateRefs:
        - name: ignis-tls
          namespace: ignis
```

If the Gateway is in a different namespace than the Certificate, create a `ReferenceGrant` to allow it to read the TLS secret:

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-gateway-tls
  namespace: ignis
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: Gateway
      namespace: traefik
  to:
    - group: ""
      kind: Secret
      name: ignis-tls
```

## Argo CD

> [!WARNING]
> Do not pass secrets (like `db.auth.password`) as Helm parameters in Argo CD — they are visible in the UI.
> Use `db.auth.existingSecret` and create the Secret separately, or use [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) / [External Secrets](https://external-secrets.io/).

Create the MongoDB secret before deploying:

```bash
kubectl create secret generic ignis-mongodb \
  --from-literal=MONGO_INITDB_ROOT_USERNAME=ignis \
  --from-literal=MONGO_INITDB_ROOT_PASSWORD="$(openssl rand -hex 32)"
```

Then create the API secret with the connection string:

```bash
MONGO_PASS=$(kubectl get secret ignis-mongodb -o jsonpath='{.data.MONGO_INITDB_ROOT_PASSWORD}' | base64 -d)

kubectl create secret generic ignis-api \
  --from-literal=StoreSettings__ConnectionString="mongodb://ignis:${MONGO_PASS}@ignis-mongodb:27017/ignis?authSource=admin"
```

Argo CD Application manifest:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ignis
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/incendilabs/ignis.git
    targetRevision: main
    path: infra/helm
    helm:
      valueFiles:
        - values.yaml
        - values-production.yaml
      parameters:
        - name: db.auth.existingSecret
          value: ignis-mongodb
  destination:
    server: https://kubernetes.default.svc
    namespace: ignis
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

## Retrieving the MongoDB password

If you need to retrieve the password after installation:

```bash
kubectl get secret ignis-mongodb -o jsonpath='{.data.MONGO_INITDB_ROOT_PASSWORD}' | base64 -d
```

## Troubleshooting

```bash
# Check pod status
kubectl get pods -l app.kubernetes.io/part-of=ignis

# View API logs
kubectl logs -l app.kubernetes.io/name=ignis-api

# View MongoDB logs
kubectl logs -l app.kubernetes.io/name=ignis-mongodb
```

> [!NOTE]
> MongoDB password changes are handled automatically on `helm upgrade` via a pre-upgrade hook that syncs the new password into the database before updating the Secret. This only applies when using a chart-managed password (`db.auth.password`), not `db.auth.existingSecret`.
