# Corporate Dangal

A parody fighting game where made-up tech and IT companies settle it in the ring.
Single player against the CPU, two players on one keyboard, two players online with a room code, or a rumble for up to five.
Online matches earn rank points on a shared leaderboard, and a directory of extra companies sits behind the main roster.

## What is in this folder

| File | What it does |
| --- | --- |
| `public/index.html` | The whole game: art, physics, moves, netcode. One file, no build step. |
| `server.js` | Serves the game, relays online matches (2 to 5 players), keeps rank points and the leaderboard. |
| `test/server.test.js` | Checks the room relay and the rank point rules against a running server. |
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
- One-on-one rooms hold two players, rumble rooms up to five. Rooms disappear when the host leaves. There is no matchmaking, accounts, or spectating.
- Free hosting tiers often put idle servers to sleep, so the first visit after a quiet period can take a while to load.

## Rumble

**Rumble: 2 to 5 players** on the title screen opens a five-seat lobby on its own map, where the whole ring stays on screen.
Seats start filled with CPUs. Add or remove CPUs, or press **Invite friends online** to get a room code and link; each friend who joins
takes a seat from a CPU. Everyone fights everyone, knocked-out fighters stay out, and the last one standing wins
(or whoever has the most health when the clock runs out). If a player drops mid-fight, a CPU takes over their fighter.

## Rank points and the leaderboard

Online matches between two or more people earn rank points (RP). CPU fighters never count.

| Players | 1st | 2nd | 3rd | 4th | 5th |
| --- | --- | --- | --- | --- | --- |
| 2 | +25 | -15 | | | |
| 3 | +30 | +5 | -15 | | |
| 4 | +35 | +15 | -5 | -15 | |
| 5 | +40 | +20 | +5 | -5 | -15 |

- From the third win in a row, each win is worth 5 more.
- Under 100 RP (Intern) you never lose points, and RP never drops below zero.
- Leaving mid-match counts as finishing last. A match shorter than 15 seconds does not count.
- Titles: Intern 0, Trainee 100, Associate 250, Senior Associate 450, Team Lead 700, Manager 1000, Director 1400, Vice President 1900, CXO 2500.

A player is a random id stored in their browser plus the name they type on the Play online screen. There are no accounts or passwords,
so clearing browser data starts a new player. Results are reported by the host's browser, which is fine among friends but not cheat-proof.

Rank points are saved in `data/ranks.json`. Many hosts wipe the app folder on every deploy or restart: attach a persistent disk and
set the `DATA_DIR` environment variable to it, or the leaderboard will reset.

## Changing things

Everything lives in the `<script>` at the bottom of `public/index.html`:

- `CH` is the roster: names, colours, head shape, thrown object, super.
- `CO` is the company directory: one row per extra company (name, sector, look, special, super). Add a row to add a company.
- `ATK` is the move list: startup, active and recovery times, damage, hitboxes, poses.
- `TICKER` and `QUIPS` are the joke text.

## Note on the parody

The companies are invented caricatures. The game is not connected to or endorsed by any real company,
and it does not use any real logos.
