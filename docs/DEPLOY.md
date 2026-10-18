# Deploy — open a URL, both play

The server is one process on one port that serves the web client, the status
endpoint, and the WebSocket signaling. The client connects **same-origin**, so
behind any HTTPS host it uses `wss://` automatically. Deploy the container
anywhere that runs a long-lived Node process with WebSocket support.

> Why not Cloudflare Workers / Vercel "edge"? Those don't hold a long-lived
> process or in-memory match state (you'd need Durable Objects / a rewrite).
> A normal container host (Fly, Railway, Render, a VPS) is the right tool and is
> effectively free at this size.

## Fly.io (recommended — global, WS-native, generous free allowance)

```bash
# one-time
curl -L https://fly.io/install.sh | sh
fly auth login

# from the repo root (edit `app` in fly.toml to something unique first)
fly launch --copy-config --now       # first deploy
# later:
fly deploy
```

Fly prints a URL like `https://your-app.fly.dev`. Both players open
**`https://your-app.fly.dev/play`**, pick two monsters, hit Quick Play. Done.

`auto_stop_machines`/`min_machines_running = 0` means it scales to zero when idle
(no cost) and cold-starts in ~1s on the next visit.

## Railway / Render (one container, same idea)

- **Railway:** `railway init` → `railway up` (it builds the Dockerfile). Railway
  injects `PORT`; the server already reads it.
- **Render:** New → Web Service → point at the repo, Docker runtime. Render also
  injects `PORT`. Enable WebSockets (on by default for web services).

## Any VPS / your own box

```bash
docker build -t ploto .
docker run -p 8080:8080 ploto
```

Put it behind Caddy/nginx/Cloudflare Tunnel for TLS and share the `/play` URL.
Caddy example (automatic HTTPS + WS pass-through):

```
play.example.com {
    reverse_proxy localhost:8080
}
```

## Config (env vars)

| Var                       | Default   | Meaning                                  |
| ------------------------- | --------- | ---------------------------------------- |
| `PORT` / `PLOTO_PORT`     | `8080`    | HTTP + WebSocket port                     |
| `PLOTO_HOST`              | `0.0.0.0` | bind address                              |
| `PLOTO_DOWNTIME`          | `0`       | `1` serves a maintenance flag at `/`      |
| `PLOTO_MAINTENANCE_REASON`| `""`      | maintenance message                       |

## Smoke-check a deploy

```bash
curl https://your-app.fly.dev/            # {"downtime":0,"reason":""}
curl https://your-app.fly.dev/play/monsters | head
# then open /play in two browsers
```
