# DEPLOY.md

Agent je jeden Node proces bez závislostí, takže ho uživí cokoli s Node 18+.

## Lokálně

```bash
cd data/capabilities/agents/proto
cp .env.example .env     # doplň OPENAI_API_KEY, pokud chceš LLM režim
node server.js
```

`PORT` v prostředí má přednost; když chybí nebo je `0`, jede se na 4319.

## VPS / vlastní server (systemd)

```ini
# /etc/systemd/system/proto.service
[Unit]
Description=Proto - AI support agent
After=network.target

[Service]
WorkingDirectory=/opt/proto
ExecStart=/usr/bin/node server.js
EnvironmentFile=/opt/proto/.env
Restart=always
User=proto

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now proto
curl -s localhost:4319/api/health
```

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=4319
EXPOSE 4319
CMD ["node", "server.js"]
```

```bash
docker build -t proto .
docker run -d --env-file .env -p 4319:4319 --name proto proto
```

Data (`tickets.jsonl`, `returns.jsonl`) jsou ve `WORKDIR/data` — připoj volume,
jinak o ně přijdeš při novém kontejneru.

## Reverzní proxy (Caddy)

```
proto.vase-domena.cz {
  reverse_proxy localhost:4319
}
```

HTTPS je povinné — widget se vkládá do HTTPS e-shopu a mixed content prohlížeč zablokuje.

## Poznámka k hostingu typu Freebuff Sites

Sites umí statické assety a Cloudflare Workery, ale **ne dlouho běžící Node server**.
Widget (`public/widget.js`) můžeš dát na CDN, ale `/api/chat` potřebuje Node host
(Render, Fly.io, Railway, VPS) nebo přepsat backend do Workera.
Pro přepsání do Workera: `server.js` → `fetch` handler, `src/*` zůstává, `store.js`
nahradit D1/KV (paměť procesu ve Workeru neexistuje).

## Checklist před předáním klientovi

- [ ] `node scripts/test-scenarios.mjs` projde
- [ ] `allowedOrigins` má konkrétní domény, ne `*`
- [ ] `.env` není v gitu, klíč je jen na serveru
- [ ] `GET /api/health` vrací `llm: true`, pokud má LLM jet
- [ ] HTTPS a správný `Content-Type` u `/widget.js`
- [ ] záloha `data/` (tikety jsou pro lidi, ne pro agenta)
- [ ] vyzkoušených 6 scénářů na produkční doméně, ne jen lokálně
