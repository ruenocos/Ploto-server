# Deploy

The server is one process on one port that serves the web client, the JSON API
and the WebSocket game traffic. Players' accounts, friends, DMs and match history
live in a single SQLite file, `postgres.db`, in the data directory (`/app/data`
in the container). Keep that directory on a volume and you keep your players.

It runs as **one replica**: matches are held in memory and SQLite has a single
writer. That's plenty for this game; scaling out would mean moving matches and
the database to shared services first.

## Kubernetes (Helm, Gateway API, cert-manager)

The chart in [`deploy/helm/ploto`](../deploy/helm/ploto) creates the Deployment,
Service, a PersistentVolumeClaim for `postgres.db`, a Gateway API `Gateway` +
`HTTPRoute`s (with an http → https redirect), and annotates the Gateway so
cert-manager issues the certificate from the `letsencrypt-prod` ClusterIssuer.

**Cluster prerequisites**

- Gateway API CRDs and a Gateway controller (Cilium, Istio, Envoy Gateway,
  NGINX Gateway Fabric, …) with a `GatewayClass`.
- cert-manager with Gateway API support turned on (Helm value
  `config.enableGatewayAPI: true`; install the Gateway API CRDs before
  cert-manager, or restart it afterwards).
- A `letsencrypt-prod` ClusterIssuer that can solve challenges for a Gateway:
  an HTTP-01 solver of type `gatewayHTTPRoute` (pointing at this Gateway or
  your shared one), or DNS-01.

**Image**

`.github/workflows/image.yml` builds the Dockerfile and pushes
`ghcr.io/<owner>/ploto-server` on every push to `main` and on `v*` tags
(`latest`, `main`, `sha-…`). Make the package public in GitHub, or add an
`imagePullSecrets` entry.

**Install**

```bash
helm upgrade --install ploto deploy/helm/ploto \
  --namespace ploto --create-namespace \
  --set hostname=play.example.com \
  --set gateway.className=cilium \
  --set statsKey.value='<your lab key>'
```

Then point DNS for the hostname at the Gateway's address (`helm` prints the
command) and watch the certificate come up:

```bash
kubectl -n ploto get gateway,httproute,certificate
```

**Using a Gateway you already run**: set `gateway.create=false` and
`gateway.existing.name` / `.namespace` / `.httpsSectionName`. The chart then
only adds the routes; TLS for that hostname is the shared Gateway's job
(annotate it with `cert-manager.io/cluster-issuer: letsencrypt-prod` and give it
a listener for the hostname). That Gateway must allow routes from this namespace.

Useful values (see [`values.yaml`](../deploy/helm/ploto/values.yaml)):

| Value | Default | |
| --- | --- | --- |
| `hostname` | `play.example.com` | public hostname |
| `gateway.create` / `gateway.className` | `true` / — | own Gateway, or attach to `gateway.existing` |
| `tls.enabled` / `tls.clusterIssuer` | `true` / `letsencrypt-prod` | cert-manager issuer |
| `statsKey.value` / `statsKey.existingSecret` | — | opens the Monster Lab API |
| `persistence.size` / `storageClass` / `existingClaim` | `1Gi` | volume for `postgres.db` |
| `route.timeouts` | `{}` | e.g. `{request: "0s"}` if your Gateway cuts long WebSockets |
| `image.tag` | `latest` | pin a `sha-…` tag for repeatable deploys |

Back up players by copying `/app/data/postgres.db` (with `sqlite3 .backup`, or
while scaled to zero). The PVC is kept if the release is uninstalled.

## A single box (Docker)

```bash
docker build -t ploto .
docker run -d -p 8080:8080 -v ploto-data:/app/data -e STATS_KEY=... ploto
```

Put it behind Caddy/nginx/Cloudflare Tunnel for TLS and share the `/play` URL.
Caddy example (automatic HTTPS + WebSocket pass-through):

```
play.example.com {
    reverse_proxy localhost:8080
}
```

## Monster Lab (balance stats from real matches)

Set `STATS_KEY` (Helm: `statsKey.value`) to open the stats API, then:

```bash
curl -H "x-lab-key: $STATS_KEY" https://your-host/api/monster-lab            # index + endpoints
curl -H "x-lab-key: $STATS_KEY" https://your-host/api/monster-lab/monsters   # win rate per monster
LAB_URL=https://your-host LAB_KEY=$STATS_KEY npm run lab                    # printed report
```

Only monster, matchup and team data is exposed; per-player records stay private
to each player's profile. Stats default to PvP matches on the current balance
patch (`includeBot=1` adds practice games, `version=all` spans patches).

## Config (env vars)

| Var | Default | Meaning |
| --- | --- | --- |
| `PORT` / `PLOTO_PORT` | `8080` | HTTP + WebSocket port |
| `PLOTO_HOST` | `0.0.0.0` | bind address |
| `PLOTO_DATA_DIR` | `./data` (`/app/data` in the image) | where `postgres.db` (SQLite) lives |
| `STATS_KEY` | — | opens `/api/monster-lab` (closed when unset) |
| `PLOTO_DOWNTIME` | `0` | `1` serves a maintenance flag at `/` |
| `PLOTO_MAINTENANCE_REASON` | `""` | maintenance message |

## Smoke-check a deploy

```bash
curl https://your-host/healthz           # {"status":"ok"}
curl https://your-host/play/monsters | head
# then open /play in two browsers
```
