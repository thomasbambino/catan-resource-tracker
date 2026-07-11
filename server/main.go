// Banker server: a single static binary that runs PocketBase (data + API +
// static SPA from pb_public) AND an in-process WebSocket realtime bridge on
// /ws. The bridge re-broadcasts every change to the games/transactions/
// players collections to all connected clients, in the exact message shape
// the web client's realtime.ts expects. This replaces the separate Node
// bridge sidecar, and — because WebSockets traverse cloud edge proxies
// cleanly where PocketBase's raw SSE does not — it works both locally and
// behind proxies like Railway's.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

// hub tracks connected websocket clients and fans out change events.
type hub struct {
	mu      sync.Mutex
	clients map[*websocket.Conn]bool
}

func newHub() *hub { return &hub{clients: map[*websocket.Conn]bool{}} }

func (h *hub) add(c *websocket.Conn) {
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
}

func (h *hub) remove(c *websocket.Conn) {
	h.mu.Lock()
	if h.clients[c] {
		delete(h.clients, c)
		c.Close()
	}
	h.mu.Unlock()
}

func (h *hub) broadcast(payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.mu.Lock()
	conns := make([]*websocket.Conn, 0, len(h.clients))
	for c := range h.clients {
		conns = append(conns, c)
	}
	h.mu.Unlock()
	for _, c := range conns {
		if err := c.WriteMessage(websocket.TextMessage, data); err != nil {
			h.remove(c)
		}
	}
}

var upgrader = websocket.Upgrader{
	// Same-origin in production; allow any origin so LAN devices connect.
	CheckOrigin: func(_ *http.Request) bool { return true },
}

func main() {
	app := pocketbase.New()

	jsvm.MustRegister(app, jsvm.Config{MigrationsDir: "./pb_migrations"})
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: false})

	h := newHub()

	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.GET("/ws", func(re *core.RequestEvent) error {
			conn, err := upgrader.Upgrade(re.Response, re.Request, nil)
			if err != nil {
				return err
			}
			h.add(conn)
			// Tell the client we're ready; it then sends a subscribe frame we
			// can safely ignore (we already broadcast all watched topics).
			_ = conn.WriteJSON(map[string]any{"type": "ready", "clientId": "server"})
			go func() {
				defer h.remove(conn)
				for {
					if _, _, err := conn.ReadMessage(); err != nil {
						return
					}
				}
			}()
			return nil
		})
		// Serve the built SPA from ./pb_public with index.html fallback.
		publicDir := os.Getenv("PUBLIC_DIR")
		if publicDir == "" {
			publicDir = "./pb_public"
		}
		e.Router.GET("/{path...}", apis.Static(os.DirFS(publicDir), true))
		return e.Next()
	})

	emit := func(action string) func(*core.RecordEvent) error {
		return func(e *core.RecordEvent) error {
			rec := e.Record
			h.broadcast(map[string]any{
				"type":   "event",
				"topic":  rec.Collection().Name + "/" + rec.Id,
				"action": action,
				"record": rec.PublicExport(),
			})
			return e.Next()
		}
	}

	cols := []string{"games", "transactions", "players"}
	app.OnRecordAfterCreateSuccess(cols...).BindFunc(emit("create"))
	app.OnRecordAfterUpdateSuccess(cols...).BindFunc(emit("update"))
	app.OnRecordAfterDeleteSuccess(cols...).BindFunc(emit("delete"))

	// Optionally create the admin (superuser) on first boot from env vars, so
	// a fresh deploy is one-shot. The app itself doesn't need it — the /_/
	// admin UI does. Runs after migrations have applied during bootstrap.
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		ensureSuperuser(app)
		return e.Next()
	})

	if len(os.Args) == 1 {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		os.Args = append(os.Args, "serve", "--http=0.0.0.0:"+port)
	}
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func ensureSuperuser(app core.App) {
	email := os.Getenv("PB_ADMIN_EMAIL")
	password := os.Getenv("PB_ADMIN_PASSWORD")
	if email == "" || password == "" {
		return
	}
	col, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return
	}
	if _, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, email); err == nil {
		return // already exists
	}
	rec := core.NewRecord(col)
	rec.SetEmail(email)
	rec.SetPassword(password)
	if err := app.Save(rec); err != nil {
		log.Println("[banker] superuser bootstrap failed:", err)
	} else {
		log.Println("[banker] created superuser", email)
	}
}
