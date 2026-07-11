# Catan Resource Tracker — a phone tracker for Catan hands

Skip the "wait, what did you have?" arguments. **Catan Resource Tracker**
records every card that moves — dice payouts, builds, trades, discards,
robber steals — so every player can see their own hand on their phone and
nobody has to trust their neighbor.

- 📱 **Everyone on their own phone.** Each person signs in with their name
  (optional PIN) and sees their own hand up top with the five resources
  broken out.
- 🔁 **Live sync.** Every move shows up on everyone's screen instantly.
- 🏦 **A real banker.** One player is designated banker at game creation
  and is the only person who can deal from the bank, move other players'
  cards, or resolve the robber. Handoff any time.
- 🏗️ **One-tap builds.** Road, Settlement, City, Dev card — the cost is
  checked and deducted in a single tap.
- 🤝 **Two-way trades.** A trade modal lets you pick what's going each
  way; the log records both sides.
- 🧾 **Full move log.** Every card movement is recorded and can be undone
  by the banker so disputes settle themselves.
- 🐳 **One container, one binary.** The web app, the database (PocketBase),
  and the realtime bridge are compiled into a single static Go binary — no
  sidecar process, no separate downloads.

Shares its identity/PIN/realtime machinery with the
[Konkan](https://github.com/thomasbambino/Konkan),
[Screw Your Neighbor](https://github.com/thomasbambino/screwyourneighbor),
and [Monopoly Banker](https://github.com/thomasbambino/monopoly-) apps.

## Run it with Docker

```bash
# From the repo root:
PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=pick-a-strong-one \
  docker compose up --build
```

The first build takes a couple of minutes (it compiles the web app and the
Go server). Once it's up, open [http://localhost:8081](http://localhost:8081)
on every phone at the table. The default port is `8081` so it can sit next
to Monopoly Banker on `8080` without conflicting.

## Deploy to Railway

`railway.json` is configured for a Dockerfile deploy with a health check
at `/api/health`. Before shipping to production, add a Railway volume
mounted at `/pb/pb_data` (otherwise every deploy wipes the game database)
and set `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` env vars.
