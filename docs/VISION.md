# Tilefun Vision

Collected ideas and strategic thinking. Living document.

## Platform Model: Open Engine + Hosted Platform

Inspired by: Bluesky/AT Protocol, WordPress, Chromium/Chrome.

**The engine is the product, not the platform.** The platform is just the best-supported
way to run the engine.

### Two deployment modes, one codebase

**Hosted platform** (like Roblox):
- Central identity / accounts
- Global persistence — pets, currency, progression follow you across realms
- Matchmaking — click play, end up with friends automatically
- Discoverability — browse worlds, trending experiences, creator marketplace
- Mobile apps (WebView wrapper or PWA), zero setup friction
- Content moderation for kid safety
- Economic flywheel: players attract creators attract players

**Open source engine** (like Minecraft modding, but first-class):
- Full source code, fork it, self-host, run locally
- Offline single-player works with zero network
- Self-host a server for family/school/community
- Full debugging, mod the engine itself, not just script on top
- Custom game modes that wouldn't pass hosted platform review
- `git clone && npm install && npm run dev` — running in 5 seconds

**Key principle**: The hosted platform competes on convenience, not lock-in. If someone
builds a better hosted version using the same open engine, that's the ecosystem working.

### Precedents

| Model | Platform | Open layer | Analogy |
|-------|----------|------------|---------|
| Bluesky / AT Protocol | Bluesky (the app) | AT Protocol (the spec) | Your identity + data are portable |
| WordPress | wordpress.com | WordPress (open source) | 40% of the web runs self-hosted |
| Chromium / Chrome | Chrome (Google sync, store) | Chromium (open source) | Powers dozens of browsers |
| Email | Gmail | SMTP/IMAP | Anyone can run a mail server |

### Hacked clients are fine

Open-source client means modified clients can connect to official servers. This is a
feature, not a bug:

- **Server authority prevents cheating.** Client can claim anything; server validates.
  This is already how tilefun works (GameServer is authoritative).
- **Closed source doesn't prevent cheating anyway.** Roblox has rampant exploiting despite
  being closed. The entire anti-cheat industry exists because obscurity doesn't work.
- **Modified clients enable good things**: accessibility mods, performance optimization,
  custom UIs, creative tools. Minecraft's modded client ecosystem (OptiFine, Sodium,
  Fabric) is a huge part of why it thrived.

What a modified client CAN do: see hidden things, improve UI, automate tedious actions.
What it CANNOT do (with server authority): spawn items, teleport, modify other players,
bypass game rules.

---

## Federation (Long-Term North Star)

Self-hosted servers can optionally federate — player identity and progression travel
between servers that trust each other.

### Layers

1. **Local identity** (default, works today): Player exists on one server, data is local.
2. **Federated identity** (opt-in): Servers that trust each other recognize the same
   player. Home server is authoritative for identity.
3. **Portable progression**: Creature collection, currency, achievements travel with you.
   Visiting server decides what it honors (may accept your pets but not your currency).

### Trust model

Like email federation, not peer-to-peer:
- Home server vouches for player identity, holds canonical data
- Other servers query it, cache it, decide their own acceptance policies
- Each server operator decides: do I federate? Which servers do I trust?

### Protocol sketch

- "Here's my player token signed by my home server"
- "Home server, what does this player's profile look like?"
- "Here's what changed during their visit, sync it back"

### Sequencing

Federation is the capstone, not the foundation:
1. Single-player / local multiplayer engine (current)
2. Self-hosted server with WebRTC (working now)
3. Well-defined player data schema and export format
4. Stable Experience API
5. Hosted platform with accounts, matchmaking, mobile apps
6. Federation protocol for server-to-server trust

The player data schema and Experience API surface are the critical early decisions — they
become the protocol boundary that federation builds on.

---

## Architecture: Engine → Experience API → Experiences

Three layers, strict dependency direction (each layer only uses the one below it):

**Layer 1 — Engine** (`src/` core):
Rendering, physics, networking, persistence, editor. Not scriptable via the Experience
API, but fully open source and forkable. This is the foundation.

**Layer 2 — Experience API** (formerly "WorldAPI" / "Mod API"):
The contract that experiences are built against. Tags, events, ticks, overlaps, entity
spawning, attributes. Stable, documented, versioned.

Roblox equivalents: CollectionService → TagService, RunService → TickService,
Touched → OverlapService, BindableEvent → EventBus, SetAttribute → attributes.

**Layer 3 — First-party experiences**:
Creative, Creature Collector, Farming, Obby, Tag, Tycoon. Written using *only* the
Experience API — no privileged access to engine internals. Ship as default content but
architecturally identical to third-party experiences.

**Key discipline**: Layer 3 never reaches into Layer 1. If an experience needs something
the Experience API doesn't provide, extend Layer 2 — don't add a special case. This is
the Roblox pattern: their own templates use the same services every creator uses.

### Terminology

- ~~Mod~~ → **Experience** (you're creating something original, not modifying a base game)
- ~~WorldAPI~~ → **ExperienceAPI**
- ~~Mod registry~~ → **Experience catalog**
- ~~Mod loader~~ → **Experience loader**
- Interface: `{ name, register(api: ExperienceAPI): Unsubscribe }`

---

## Core Experiences

What game modes to build, informed by Roblox's most successful genres and our playtesting
insights. See `docs/research/roblox-economy-and-ownership.md` for detailed Roblox research.

### Design principles (from Roblox patterns)

1. **Collection + Rarity** — the single most universal motivator for kids
2. **Trading as social glue** — turns solo collecting into a social economy
3. **Visible progress** — players can SEE their world filling up
4. **Low barrier** — every mode understandable in under 30 seconds
5. **Asymmetric play** — parent builds, kid plays (or vice versa)

### Creative Mode (the base experience — always loaded)

Creative mode is not a development tool — it IS the first and most important experience.
Minecraft Creative is the most popular mode with kids under 10. Our playtesting confirms
this: spawning 50 chickens, collecting gems, placing structures — that's creative mode
gameplay and it's already fun.

- Terrain editor, entity spawning, structure placement
- Unlimited resources, no gates, no currency costs
- Where the engine gets tested, where kids play freely, where parents build worlds
- **Creative mode is the God mode for every other experience.** Collector mode adds
  scarcity constraints; creative mode removes them. Same content, different rules.

### Creature Collector (layered on creative)

The Adopt Me! / Pet Simulator model on a tile world.

- Eggs spawn or hide in terrain — find them, hatch them
- Rarity tiers: Common chicken, Rare golden chicken, Legendary phoenix
- Nurture loop: feed, play, age up (Newborn → Full Grown)
- Neon/Mega evolution: combine 4 Full Grown → Neon variant (glow). 4 Neons → Mega Neon
- Trading in multiplayer
- Home = your tile world — decorating IS the flex
- **The deeper mechanic**: social status through collection, not the pets themselves
- In creative mode: spawn any creature directly (sandbox/cheat mode for collector)

Fits our playtesting: kid already loves spawning 50 chickens, collecting gems. She's
already playing creature collector — just without the scarcity layer.

### Garden / Farming Sim (layered on creative)

Inspired by Grow a Garden (21.6M concurrent, made by a 16-year-old) and Stardew Valley.

- Plant seeds on tiles, they grow over multiple waterings
- Mutations: crops randomly mutate into rare variants worth much more
- Harvest → sell → buy better seeds → expand plots
- Trading economy for rare plants
- Maps directly onto existing tile/chunk system
- Modern Exteriors has a farming tileset available

**Stardew adaptations for a 6-year-old:**
- No energy/stamina — unlimited actions
- No time pressure — growth based on waterings, not calendar
- No reading-heavy UI — icons and colors
- Everything additive, no negative consequences
- Immediate visual feedback for every action

### Tag / Minigames (mode switch, uses creative-built worlds)

- Parent builds arenas/obstacle courses in editor
- Short rounds (1-3 min), zero punishment for losing
- Asymmetric roles: "it" vs runners, hiders vs seekers
- Hide and seek with NPCs or other players
- Tile editor = map maker — co-op parent/kid editing shines here

### Tycoon (economy layer on creative)

- Place structures that generate resources (coins, visitors)
- NPCs visit and rate your creation
- Earn → expand → attract more visitors
- Rebirth/prestige: reset for permanent multipliers (finite → infinite game)
- Escalating plot costs: first plot cheap, each expansion costs more
- Visible "FOR SALE" signs on locked land create aspiration

### Obby (mode switch, uses creative-built worlds)

"Obby" = Roblox slang from "obstacle course."

- Checkpoints, hazards (lava tiles, gaps, moving entities), timer
- Simplest genre to implement, hugely popular
- Pure skill expression, instant restart on death
- Hand-built or procedurally generated courses

---

## Economy Design

Start simple (Adopt Me model), add complexity only as needed.

### Single currency (gems)

- Already exists in tilefun
- Earned through: harvesting, collecting, finding hidden things, tasks
- Spent on: seeds, eggs, plot expansions, decorations, creature accessories
- Daily earning cap optional (encourages regular play sessions)
- No real-money path initially (family game, not a platform yet)

### Plot expansion

- Chunk-based: "buy adjacent chunks" with gem costs
- Escalating cost curve (Lumber Tycoon pattern: $100, $3000, $6000, ...)
- Visible locked areas with markers create aspiration
- Strategic tension: expand vs optimize current plots

### What NOT to make tradeable

- Currency is NOT tradeable between players (prevents inflation)
- Only items/creatures are tradeable (creates the social economy)

---

## World Ownership

### Home realm

- Each player has a home realm — a world they own and can edit
- Other players can visit but not edit (unless owner grants permission)
- Owner's realm persists in their storage (IndexedDB local, server DB hosted)
- Multiplayer: visit each other's realms via access code or friend-join

### No spatial permanence needed (Brookhaven insight)

Roblox games like Brookhaven have zero spatial permanence — your house data loads into
whatever physical plot the server assigns. Kids don't care about map position; they care
about what's inside their house.

But tilefun is different: **terrain edits are the content.** The world itself has spatial
permanence because the player built it. "Come visit my world" is more meaningful than
"come visit my house at a random address."

This is the Minecraft model, not the Brookhaven model. The world IS the permanent address.

---

## AI-Augmented Creation (Skills)

### The competitive advantage

The TypeScript + npm stack makes tilefun uniquely well-suited for AI-assisted creation.
The entire create → test → publish loop is automatable:

1. AI agent reads the Experience API / engine source
2. Writes TypeScript experience
3. Runs `npx tsc --noEmit` (typecheck)
4. Runs `npx vitest` (unit tests)
5. Runs `npx playwright test` (E2E)
6. Iterates until tests pass
7. Opens a PR

**Zero human intervention required** for the technical verification. Human's role shifts
from "verify it works" to "decide if I want it."

Compare to Roblox: creator must manually test in Studio (proprietary GUI, no headless
testing, no CI/CD). AI can write Luau but can't close the loop.

### Skills as domain-encoded knowledge

Repository skills (`.claude/skills/` or similar) encode tilefun's domain constraints so
AI agents don't have to rediscover them each time:

| Skill | Input | Output |
|-------|-------|--------|
| `generate-sprite` | "a firefly with glow" | 16x16 spritesheet PNG, correct frame layout |
| `generate-terrain-sheet` | "volcanic rock" | 47-variant GM blob autotile sheet |
| `generate-sfx` | "chicken cluck" | WAV sound effect |
| `generate-music` | "cozy farm ambient" | Background music loop |
| `create-experience` | gameplay description | Tested experience using ExperienceAPI |
| `create-creature` | creature description | End-to-end: sprite + factory + AI behavior + sounds |
| `create-biome` | biome description | Terrain sheets + adjacency rules + generation strategy + creatures |

### Sprite generation technique

LLMs can generate pixel art as ASCII grids — each character encodes a palette color:

```
.......YY.......    Y = yellow
......YYYY......    W = white
.....YYYYYY.....    O = orange
....WWWWWWWW....    . = transparent
...WWWWWWWWWW...
....WWWWWWWW....
.....OO.OO......
```

A Python script (Pillow) maps characters to RGB and writes PNG. Works because 16x16
pixel art is a constrained design problem — limited palette, limited resolution, clear
rules. Exactly what LLMs excel at.

This technique extends to autotile terrain sheets: the 47 GM blob variants follow rigid
structural rules from the bitmask, making them well-suited for systematic generation.

### The compounding effect

Each skill added makes the AI more capable as a game creator, not just a code writer.
Skills accumulate domain knowledge: sprite dimensions, autotile format, entity component
schema, Experience API surface. The skill library IS the developer experience.

Every contributor gets the same skills. A teenager and an experienced dev have the same
creative toolkit. The barrier to creating a polished experience drops to describing what
you want.

### Why TypeScript wins for AI creation

- Largest developer population (web devs) = most training data for AI
- Strong type system catches errors at compile time (AI gets fast feedback)
- Standard tooling (npm, vitest, playwright) = automatable CI/CD
- Human-readable source (vs binary assets, proprietary formats)
- `npm build` in 5 seconds vs 30-minute C++ compile
- Hot reload during development

---

## Roblox Research References

Detailed research notes in `docs/research/`:
- `wire-protocol-survey.md` — QuakeWorld, RTS, MMO, and Roblox networking approaches
- `roblox-economy-and-ownership.md` — Roblox economy, ownership, plot mechanics, publishing

### Key Roblox facts

- Roblox had first-party games 2006-2008, then went pure UGC platform
- #1 game (Brookhaven, 69B visits) has NO game mechanics — pure social roleplay
- Grow a Garden (made by a 16-year-old) hit 21.6M concurrent, breaking Fortnite's record
- Server instances are ephemeral: 28 players per Brookhaven server, thousands of instances
- Plot assignment is trivially simple: maxPlayers = plotCount, assign on join, release on leave
- No platform-level plot ownership — all game logic using DataStore
- Matchmaking reserves "social slots" for friend joins (players spend 30% more time with friends)
- Private servers (player-purchased) and reserved servers (code-created) for families/groups
