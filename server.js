// Appraisal Akhada: static file server + room-code relay for online matches.
// Run with: npm install && npm start   (then open http://localhost:3000)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split("?")[0]); } catch (e) { res.writeHead(400); return res.end("Bad request"); }
  if (p === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

// rooms: code -> { host, guest }
const rooms = new Map();
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, they get misread
function newCode() {
  for (;;) {
    let c = "";
    for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!rooms.has(c)) return c;
  }
}
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function leave(ws) {
  const code = ws.room; if (!code) return;
  ws.room = null;
  const r = rooms.get(code); if (!r) return;
  if (r.host === ws) {
    rooms.delete(code);
    if (r.guest) { r.guest.room = null; send(r.guest, { t: "left" }); }
  } else if (r.guest === ws) {
    r.guest = null;
    send(r.host, { t: "left" });
  }
}

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 32 * 1024 });
wss.on("connection", (ws) => {
  ws.room = null; ws.alive = true;
  ws.on("pong", () => { ws.alive = true; });
  ws.on("message", (raw, isBinary) => {
    if (isBinary) return;
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!m || typeof m.t !== "string") return;
    if (m.t === "ping") return;
    if (m.t === "host") {
      leave(ws);
      if (rooms.size >= 500) return send(ws, { t: "err", m: "The server is full right now. Try again in a bit." });
      const code = newCode();
      rooms.set(code, { host: ws, guest: null }); ws.room = code;
      return send(ws, { t: "room", code });
    }
    if (m.t === "join") {
      const code = String(m.code || "").toUpperCase();
      const r = rooms.get(code);
      if (!r) return send(ws, { t: "err", m: "No room with the code " + code + ". Check it with your friend." });
      if (r.guest) return send(ws, { t: "err", m: "That room already has two players." });
      leave(ws);
      r.guest = ws; ws.room = code;
      send(ws, { t: "joined", code });
      return send(r.host, { t: "peer" });
    }
    // everything else is game traffic: pass it to the other player in the room
    const r = rooms.get(ws.room); if (!r) return;
    const other = r.host === ws ? r.guest : r.host;
    if (other && other.readyState === 1) other.send(raw.toString());
  });
  ws.on("close", () => leave(ws));
  ws.on("error", () => {});
});
// drop dead connections so rooms do not linger
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
}, 30000);

server.listen(PORT, () => console.log("Appraisal Akhada running on http://localhost:" + PORT));
