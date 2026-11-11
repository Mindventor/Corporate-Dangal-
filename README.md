# Corporate Dangal

A parody fighting game where made-up tech and IT companies settle it in the ring.
Single player against the CPU, two players on one keyboard, or two players online with a room code.

## What is in this folder

| File | What it does |
| --- | --- |
| `public/index.html` | The whole game: art, physics, moves, netcode. One file, no build step. |
| `server.js` | Serves the game and relays online matches between two players. |
| `package.json` | Lists the single dependency (`ws`, for WebSockets). |

## Run it on your own computer

You need Node.js 18 or newer.

```
npm install
npm start
```

Open http://localhost:3000. Single player and same-keyboard play work straight away.
To test online play locally, open the page in two browser windows: host a room in one, join with the code in the other.

## Put it on the internet

Online play needs `server.js` running, so use a host that runs Node apps and supports WebSockets
(Render, Railway, Fly.io, a VPS, and similar). Static-only hosts such as GitHub Pages will serve the
game, but the "Play online" button will not connect there.

The settings are the same on every Node host:

- Build command: `npm install`
- Start command: `npm start`
- Port: the server reads the `PORT` environment variable, which these hosts set for you. It falls back to 3000.
- Health check path (optional): `/healthz`

Typical flow: push this folder to a GitHub repository, create a new "web service" on the host, point it at
the repository, enter the two commands above, and deploy. You get a public URL; that URL is your game.

## How online play works

1. One player clicks **Play online with a friend**, then **Create a room**, and gets a 4-letter code and an invite link.
2. The other player opens the link, or enters the code under **Join a room**.
3. Both pick a company. The host picks the venue and starts the fight.

The host's browser runs the match and sends the game state to the guest about 30 times a second; the guest
sends back button presses. Things to know:

- The guest feels a little input delay that grows with distance between the two players.
- The host should keep the game tab in front. Browsers pause background tabs, which freezes the match for both players.
- Rooms hold exactly two players and disappear when the host leaves. There is no matchmaking, accounts, or spectating.
- Free hosting tiers often put idle servers to sleep, so the first visit after a quiet period can take a while to load.

## Changing things

Everything lives in the `<script>` at the bottom of `public/index.html`:

- `CH` is the roster: names, colours, head shape, thrown object, super.
- `ATK` is the move list: startup, active and recovery times, damage, hitboxes, poses.
- `TICKER` and `QUIPS` are the joke text.

## Note on the parody

The companies are invented caricatures. The game is not connected to or endorsed by any real company,
and it does not use any real logos.
