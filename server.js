// Corporate Dangal: static file server, room-code relay for online matches (2 to 5 players), rank points and leaderboard.
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
  if (p === "/api/daily" && req.method === "POST") { // daily challenge score. ponytail: reported by the browser, so it can be faked; fine for a joke board.
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 2048) req.destroy(); });
    req.on("end", () => {
      let m; try { m = JSON.parse(body); } catch (e) { m = null; }
      const day = new Date().toISOString().slice(0, 10);
      if (!m || typeof m.id !== "string" || !/^[a-f0-9]{32}$/.test(m.id) || m.day !== day || !Number.isInteger(m.score) || m.score < 0 || m.score > 4000) { res.writeHead(400); return res.end("Bad request"); }
      const pl = ranks[m.id] || (ranks[m.id] = { n: "Player", rp: 0, g: 0, w: 0, s: 0 });
      pl.n = cleanName(m.name);
      if (pl.dd !== day) { pl.dd = day; pl.ds = 0; }
      if (m.score > pl.ds) pl.ds = m.score;
      save();
      const today = Object.keys(ranks).filter((k) => ranks[k].dd === day).sort((a, b) => ranks[b].ds - ranks[a].ds);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ best: pl.ds, rank: today.indexOf(m.id) + 1, n: today.length }));
    });
    return;
  }
  if (p === "/api/lb") { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(leaderboard(new URL(req.url, "http://x").searchParams.get("id")))); }
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

// ---------- Rank points ----------
// ranks: player id -> { n: name, rp, g: games, w: wins, s: current win streak }. Kept in one JSON file.
// ponytail: whole-file JSON rewrite, fine for a few thousand players; move to SQLite when it is not. Set DATA_DIR to a persistent disk on hosts that wipe the app folder.
const DATA = path.join(process.env.DATA_DIR || path.join(__dirname, "data"), "ranks.json");
let ranks = {};
try { ranks = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch (e) {}
let saveT = null;
function save() {
  if (saveT) return;
  saveT = setTimeout(() => { saveT = null;
    fs.mkdir(path.dirname(DATA), { recursive: true }, () => fs.writeFile(DATA + ".tmp", JSON.stringify(ranks), (e) => { if (!e) fs.rename(DATA + ".tmp", DATA, () => {}); }));
  }, 2000);
}
// Points by finishing place among the human players in the room (index 0 is first place).
const PTS = { 2: [25, -15], 3: [30, 5, -15], 4: [35, 15, -5, -15], 5: [40, 20, 5, -5, -15] };
function award(id, name, place, n) {
  const p = ranks[id] || (ranks[id] = { n: name, rp: 0, g: 0, w: 0, s: 0 });
  let d = PTS[n][place];
  p.s = place === 0 ? p.s + 1 : 0;
  if (place === 0 && p.s >= 3) d += 5;      // win streak bonus from the third win in a row
  if (d < 0 && p.rp < 100) d = 0;           // interns are on probation: no losses under 100
  p.n = name; p.rp = Math.max(0, p.rp + d); p.g++; if (place === 0) p.w++;
  save();
  return { t: "rp", d, rp: p.rp, s: p.s };
}
const cleanName = (n) => String(n || "").replace(/[^\w .\-]/g, "").trim().slice(0, 14) || "Player";
function leaderboard(id) {
  const day = new Date().toISOString().slice(0, 10);
  const daily = Object.keys(ranks).filter((k) => ranks[k].dd === day).sort((a, b) => ranks[b].ds - ranks[a].ds).slice(0, 10).map((k) => ({ n: ranks[k].n, s: ranks[k].ds, me: k === id }));
  const all = Object.keys(ranks).filter((k) => ranks[k].g > 0).sort((a, b) => ranks[b].rp - ranks[a].rp || ranks[b].w - ranks[a].w);
  const row = (k) => ({ n: ranks[k].n, rp: ranks[k].rp, g: ranks[k].g, w: ranks[k].w });
  const at = id ? all.indexOf(id) : -1;
  return { top: all.slice(0, 50).map(row), me: at < 0 ? null : Object.assign({ rank: at + 1 }, row(all[at])), players: all.length, daily };
}
// ponytail: results are reported by the host's browser, so a modified client can lie. Fine for friends; needs a server-run match to be cheat-proof.
function startMatch(r) {
  const hs = []; r.m.forEach((w, i) => { if (w) hs.push(i); });
  const ids = hs.map((i) => r.m[i].pid);
  // ranked only when every player is identified and they are all different people
  r.live = { t: Date.now(), n: hs.length, quit: [], who: {}, ranked: hs.length >= 2 && ids.every(Boolean) && new Set(ids).size === ids.length };
  hs.forEach((i) => { r.live.who[i] = { id: r.m[i].pid, name: r.m[i].pname }; });
}
function endMatch(r, pl) {
  const L = r.live; r.live = null;
  if (!L || !L.ranked || Date.now() - L.t < 15000 || !Array.isArray(pl)) return;
  const left = Object.keys(L.who).map(Number).filter((i) => !L.quit.includes(i));
  const order = pl.filter((i) => left.includes(i));
  if (order.length !== left.length || new Set(order).size !== order.length) return;
  order.forEach((i, place) => send(r.m[i], award(L.who[i].id, L.who[i].name, place, L.n)));
}

// rooms: code -> { m: [host, guest, ...] (a seat is null when empty), max, live }
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
  const i = r.m.indexOf(ws); if (i < 0) return;
  const L = r.live;
  if (L && L.ranked && L.who[i] && !L.quit.includes(i)) { // walking out mid-match counts as finishing last
    L.quit.push(i); award(L.who[i].id, L.who[i].name, L.n - L.quit.length, L.n);
    const left = Object.keys(L.who).map(Number).filter((k) => !L.quit.includes(k));
    if (left.length === 1) { // everyone else walked out: the one who stayed takes first place
      L.ranked = false;
      if (Date.now() - L.t >= 15000) send(r.m[left[0]], award(L.who[left[0]].id, L.who[left[0]].name, 0, L.n));
    }
  }
  if (i === 0) {
    rooms.delete(code);
    r.m.forEach((g) => { if (g && g !== ws) { g.room = null; send(g, { t: "left" }); } });
  } else {
    r.m[i] = null;
    send(r.m[0], { t: "left", n: i });
    if (r.max === 2) r.live = null;
  }
}

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 32 * 1024 });
wss.on("connection", (ws) => {
  ws.room = null; ws.alive = true; ws.pid = ""; ws.pname = "Player";
  ws.on("pong", () => { ws.alive = true; });
  ws.on("message", (raw, isBinary) => {
    if (isBinary) return;
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!m || typeof m.t !== "string") return;
    if (m.t === "ping") return;
    if (m.t === "hello") { // who is this, for rank points
      if (typeof m.id === "string" && /^[a-f0-9]{32}$/.test(m.id)) ws.pid = m.id;
      ws.pname = cleanName(m.name);
      const p = ranks[ws.pid];
      return send(ws, { t: "me", rp: p ? p.rp : 0, g: p ? p.g : 0, w: p ? p.w : 0 });
    }
    if (m.t === "host") {
      leave(ws);
      if (rooms.size >= 500) return send(ws, { t: "err", m: "The server is full right now. Try again in a bit." });
      const code = newCode();
      rooms.set(code, { m: [ws], max: Math.min(5, Math.max(2, m.max | 0)), live: null }); ws.room = code;
      return send(ws, { t: "room", code });
    }
    if (m.t === "join") {
      const code = String(m.code || "").toUpperCase();
      const r = rooms.get(code);
      if (!r) return send(ws, { t: "err", m: "No room with the code " + code + ". Check it with your friend." });
      let n = -1; for (let i = 1; i < r.max; i++) if (!r.m[i]) { n = i; break; }
      if (n < 0) return send(ws, { t: "err", m: r.max > 2 ? "That room is full." : "That room already has two players." });
      if (r.live) return send(ws, { t: "err", m: "That room is in the middle of a match. Try again in a minute." });
      leave(ws);
      r.m[n] = ws; ws.room = code;
      send(ws, { t: "joined", code, n, max: r.max });
      return send(r.m[0], { t: "peer", n, name: ws.pname });
    }
    // everything else is game traffic: the host's messages go to every guest, a guest's go to the host with their seat number
    const r = rooms.get(ws.room); if (!r) return;
    const i = r.m.indexOf(ws);
    if (i === 0) {
      if (m.t === "start") startMatch(r);
      else if (m.t === "res") endMatch(r, m.pl);
      else if (m.t === "sel") r.live = null;
      const out = raw.toString();
      for (let k = 1; k < r.m.length; k++) { const g = r.m[k]; if (g && g.readyState === 1) g.send(out); }
    } else if (i > 0) {
      m.n = i; send(r.m[0], m);
    }
  });
  ws.on("close", () => leave(ws));
  ws.on("error", () => {});
});
// drop dead connections so rooms do not linger
setInterval(() => {
  wss.clients.forEach((ws) => { if (!ws.alive) return ws.terminate(); ws.alive = false; ws.ping(); });
}, 30000);

server.listen(PORT, () => console.log("Corporate Dangal running on http://localhost:" + PORT));
