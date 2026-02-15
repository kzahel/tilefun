# Roblox Economy, Ownership, and Creator Systems

Research compiled February 2026. All information sourced from Roblox official documentation,
developer forums, wiki pages, and game-specific resources.

---

## 1. World/Place Ownership in Roblox

### Experience vs Place

Roblox distinguishes between **experiences** and **places**:

- An **experience** is the top-level container — what players see in search results and on the
  Roblox website. It has a unique experience ID, settings, monetization, analytics, etc.
- A **place** is a single map/level within an experience. Every experience has a **start place**
  (what players load into first) and can have additional places that players teleport between.
- Players cannot directly visit non-start places — they must enter through the start place or
  be teleported by game logic.

This is roughly analogous to: experience = "game" and place = "level/world/dimension."

### Who Owns an Experience

- Experiences are owned by either an **individual user account** or a **group**.
- The owner has full administrative control: settings, monetization, publishing, content
  management.
- Ownership can be **transferred** from an individual to a group (but not the reverse, and not
  between individuals). The transfer process:
  1. Creator initiates from Configure > Settings
  2. Selects a target group where they have publishing permissions
  3. Acknowledges implications in a Transfer Details dialog
  4. Verifies by typing the experience name
  5. Recipient group accepts the transfer
- Transfer requests expire after 7 days. There is a mandatory 30-day cooldown before
  re-transferring the same experience.
- On transfer, Roblox makes the experience **private** and closes all active servers. The
  experience ID, place ID, and URL are preserved.

### Player-Owned Plots Within an Experience

This is entirely **game-level logic** — Roblox the platform has no built-in concept of "player
plots." Individual experiences implement this pattern in their own scripting:

**Brookhaven RP** (115+ properties):
- When a player joins, they can claim a house for **free** by clicking the house icon and
  selecting from available starter homes.
- Multiple property types: Houses, Apartments, Motels, Estates, Landmarks.
- Properties have interactive features: lockable doors, window blinds, security cameras,
  furniture placement.
- Some premium houses require **game passes** (one-time Robux purchase).
- Interiors are loaded/unloaded client-side for performance — when you enter a house, the
  interior is parented from ReplicatedStorage into Workspace, and the exterior neighborhood
  is hidden.
- There is no real persistence of "land ownership" at the platform level — it is all managed
  by the experience's DataStore.

**Adopt Me!** (housing system):
- Every player gets a starter house.
- Players can upgrade to different house types using in-game currency (Bucks).
- Houses are instanced — each player has their own interior space.
- Furniture placement and customization are persisted via DataStore.

**Common Technical Pattern** (from Roblox developer forums):
1. Server maintains a list of available plots/slots.
2. On player join, assign an available plot or instantiate a new one.
3. Store plot ownership + customization in DataStore (Roblox's key-value persistence).
4. Use client-side visibility culling: parent unused areas to ReplicatedStorage, move relevant
   areas into Workspace when the player approaches.
5. Interior transitions: hide exterior, show interior model — all on the client side.

**Key takeaway for tilefun**: Roblox has no platform-level "plot ownership." It is 100% game
logic. The platform provides persistence (DataStore) and the game manages who owns what.

---

## 2. Roblox Economy

### Robux (Platform Currency)

- **Robux** is the universal premium currency across all of Roblox.
- Players buy Robux with real money (~$1 = 80 Robux at standard rates, varies by package).
- Robux are spent on: avatar items, game passes, developer products, and Premium
  subscriptions.

### How Creators Monetize

There are **six** primary monetization channels:

#### a) Game Passes (one-time purchases)
- A game pass grants permanent access to a privilege/feature within an experience.
- Examples: VIP status, double XP, special cosmetics, premium house types, extra inventory
  slots.
- **One-time purchase** — player buys once, keeps forever (even across sessions).
- Creator receives **70%** of the Robux price; Roblox takes 30%.

#### b) Developer Products (repeatable purchases)
- Items/abilities a player can purchase **multiple times**.
- Examples: in-game currency bundles, extra lives, ammo packs, energy refills, loot boxes.
- Same 70/30 revenue split.
- This is how most in-game currency purchases work (buy 1000 Bucks for 100 Robux, etc.).

#### c) Creator Rewards (formerly Premium Payouts / Engagement-Based Payouts)
- Replaced the old "Premium Payout" system on July 24, 2025.
- Creators earn Robux based on how much time players spend in their experience.
- The more engaging the experience, the more passive income it generates.

#### d) Rewarded Video Ads
- Launched and scaled across hundreds of experiences in 2025.
- Players aged 13+ can opt-in to watch a 6-30 second video ad in exchange for in-game
  rewards (extra lives, currency boosts, gameplay shortcuts).
- Creator earns ad revenue.

#### e) Creator Store (asset marketplace)
- Creators sell Models, Plugins, Audio, Fonts, Decals to other developers.
- **100% revenue to creators** — Roblox eliminated its cut for developer-to-developer asset
  sales.
- Requires: verified account, Premium subscription, 2FA.
- Typical pricing: 200-400 Robux for models, 500-1000 for plugins.

#### f) UGC Avatar Items
- Creators design avatar clothing/accessories using external tools (Blender, etc.).
- Sell on the Avatar Shop.
- Creator receives **70%**, Roblox takes 30%.

### Developer Exchange (DevEx)

- Converts earned Robux into real USD.
- Requirements: 30,000+ earned Robux minimum, age 13+, verified email, tax documentation.
- Exchange rate: approximately **$0.0035-$0.0038 per Robux** (so 100,000 Robux = ~$350-380).
- From March 2024 to March 2025, Roblox creators earned over **$1 billion** globally through
  DevEx.

### Effective Creator Take Rate

Working through the full chain:
1. Player spends $1.00 to buy ~80 Robux.
2. Player spends 80 Robux on a game pass.
3. Creator receives 70% = 56 Robux.
4. Creator cashes out via DevEx at $0.0035/Robux = **$0.196**.
5. Effective creator take: **~20% of player spend**.

This is significantly lower than other platforms (Steam ~70%, Apple ~70%). Roblox justifies it
by providing hosting, distribution, moderation, and the player base.

---

## 3. In-Game Economies in Popular Roblox Experiences

### Adopt Me! (Bucks)

**Currency**: Bucks (single currency)

**Earning methods**:
- Fulfilling baby/pet needs (ailments) — primary earning method
- Daily login rewards: 25 -> 50 -> 100 -> 200 -> gift (5-day cycle, resets)
- Working jobs: Pizza Shop, Salon
- Operating stands: Lemonade Stand (50 Bucks), Hotdog Stand (95 Bucks), Cotton Candy Stand
  (50 Bucks)

**Daily cap**: 300 Bucks/in-game day (500 with Pet Handler Pro Certificate). Doubled during
x2 weekend events.

**Spending**:
- Eggs (hatch pets) — primary sink
- Furniture for house
- Food, toys, gifts, vehicles

**Robux purchase**: Players can buy Bucks directly with Robux (developer product). ~50 Bucks
for 24 Robux.

**Economy design insight**: Adopt Me uses a **single soft currency** with daily caps to create
a slow drip that encourages either patience or Robux spending. The pet trading economy
(player-to-player) is the real endgame economy, and Bucks are not tradeable — only pets are.

### Blox Fruits (Triple Currency)

**Currencies**:
1. **Money** — easiest to obtain, highest prices. Earned from quests, defeating enemies,
   fishing, collecting chests. Used for: Fighting Styles, Swords, Guns, Blox Fruits,
   Accessories, Abilities, Raid Chips.
2. **Fragments** — harder to obtain, dropped in smaller amounts from bosses and raids. Used
   for: unlocking special items, awakening fruits. Specific drops: Terrorshark (300),
   Cake Prince (1,000), Dough King (2,000), Raids (300-1,000).
3. **Valor** — PvP-only currency, earned exclusively by defeating other players. Creates a
   separate progression track for PvP-focused players.

Also has event currencies: Bones, Ectoplasm, Candies, Confetti, Hearts.

**Economy design insight**: Multiple currencies let different playstyles (PvE grinding, boss
raiding, PvP combat) each have their own progression. Event currencies create FOMO and
engagement spikes.

### Pet Simulator 99 / X (Multi-Currency)

**Currencies**:
- **Coins** — primary, earned from clicking/tapping. Capacity: 99.9 trillion.
- **Diamonds/Gems** — premium currency for upgrades, fusing, enchanting, trading.
  Capacity: 9.99 trillion.
- **Tech Coins** — special currency for Tech World content. 1 Tech Bar = 1M Tech Coins.
- **Fantasy Coins** — world-specific (Fantasy World).
- **Rainbow Coins** — world-specific (Axolotl Ocean, Pixel World, Cat World).

**Economy design insight**: World-specific currencies force players to engage with each content
area rather than grinding one optimal source. The enormous number caps (trillions) create a
number-go-up dopamine loop characteristic of idle/incremental games.

### Common Patterns Across Roblox Games

| Pattern | Examples | Purpose |
|---------|----------|---------|
| Single soft currency + daily cap | Adopt Me (Bucks) | Slow drip, encourages Robux purchase |
| Multiple tiered currencies | Blox Fruits (Money/Fragments/Valor) | Separate progression per activity |
| World-specific currencies | Pet Sim (Tech/Fantasy/Rainbow Coins) | Force engagement breadth |
| Event/seasonal currencies | Most games (Candies, Hearts, etc.) | FOMO, engagement spikes |
| Buyable with Robux (developer product) | Nearly all games | Primary monetization |
| NOT tradeable between players | Adopt Me Bucks, most currencies | Prevents inflation, forces earning |
| Tradeable items (not currency) | Adopt Me pets, Blox Fruits items | Player-driven secondary economy |

---

## 4. Plot/Land Expansion Mechanics

### Lumber Tycoon 2 (Classic Land Buying)

- First plot: **$100** in-game money.
- First expansion: **$3,000**; each subsequent expansion costs $3,000 more than the last.
- Maximum: 25 plots, each expandable from 40x40 to 200x200 units.
- Total cost to fully expand one plot: **$900,100**.
- Escalating cost curve creates a long-term progression goal.
- Land purchases include a cutscene (sense of accomplishment).

### Theme Park Tycoon 2 (Plot Grid)

- 4 free starter plots.
- 60 additional plots purchasable with in-game money or credits.
- Some plots require the **Extra Expansion Gamepass** (Robux purchase).
- Total cost for all purchasable plots: **$1,600,000** + 9,000 credits.
- Locked plots appear as dry grass with "LAND FOR SALE!" signs — visible aspiration.
- Mixed economy: some plots are in-game currency only, some require real money (game pass).

### Common Tycoon Patterns

**The Dropper/Conveyor Pattern** (most common Roblox tycoon formula):
1. Player claims a plot (free, auto-assigned on join).
2. First dropper/generator is free or cheap.
3. Conveyors move items to a collector that converts them to currency.
4. Currency buys upgrades: better droppers, faster conveyors, more plots.
5. Each upgrade tier costs exponentially more.
6. Plot expansions are progression gates — you must earn enough before expanding.

**Progression Gate Taxonomy**:
- **Currency gates**: Accumulate X amount of in-game currency.
- **Level gates**: Reach level/prestige X before unlocking.
- **Game pass gates**: Some expansions only available via Robux.
- **Quest gates**: Complete specific tasks/challenges to unlock area.
- **Time gates**: Wait X minutes/hours (often skippable with Robux).

**Key design principle**: Resist the urge to expand early — "strategic players focus resources
on what produces income immediately" before buying more territory. This creates a meaningful
decision between expansion and optimization.

---

## 5. Roblox Review/Publishing Pipeline

### Publishing an Experience

1. **Create in Roblox Studio** — build the place(s), write scripts, set up monetization.
2. **Publish to Roblox** — from Studio, File > Publish to Roblox. Choose whether it is
   public or private.
3. **Complete Maturity & Compliance Questionnaire** — required for all public experiences.

### New Publishing Requirements (December 2025)

As of December 17, 2025, creators must meet **at least one** of these criteria to publish or
update public experiences:

- Complete **ID Verification** (government-issued ID)
- Have made a **real-currency purchase or gift card redemption** since January 1, 2025

Transitional options (expired December 10, 2025):
- Had edit access to an experience with 100+ playtime hours
- Successfully completed a DevEx request in the past 12 months

**Existing public experiences are unaffected** — they stay public. But pushing updates requires
meeting the eligibility criteria.

Only the person **publishing** needs to qualify; collaborators can edit freely.

This was introduced to combat spam, content cloning, and Community Standards violations by
creating "a persistent obstacle" for bad actors. The community response was largely negative,
with developers arguing it penalizes legitimate new creators.

### Content Moderation

Roblox uses a **multi-layered moderation system**:

#### Automated (AI-first)
- **Upload scanning**: Images, meshes, audio, video are automatically scanned before appearing
  on the platform. Images checked for CSAM and policy violations. Audio scanned for IP
  infringement.
- **Text filtering**: Processes an average of **6.1 billion chat messages per day** using
  purpose-built ML models for different violation types.
- **Experience scanning**: Published/updated experiences are evaluated by automated tools for
  problematic language, filter bypasses, and policy violations.
- Almost all violating content is **prescreened and removed before users ever see it**.

#### Human Review
- A continuous human review team evaluates flagged content.
- Trained to detect subtle issues AI might miss.
- Handle appeals from creators who believe their content was incorrectly moderated.

#### Maturity Ratings
Five categories: **N/A, Minimal, Mild, Moderate, Restricted**

- Based on a self-reported questionnaire the developer fills out.
- Questions cover: blood, violence, fear, romance, crude humor, gambling-like mechanics, etc.
- Roblox moderation team may review the accuracy of self-reported ratings.
- Players' age determines which maturity tiers they can access.

#### Moderation Actions
Range from warnings to content removal to account restrictions, based on severity. Creators
can request a second review of moderation decisions.

---

## 6. Roblox Scripting Model

### Language: Luau

- **Luau** (pronounced "loo-ow") is Roblox's scripting language.
- Derived from **Lua 5.1** but significantly extended.
- Key addition: **gradual typing** — optional type annotations with strict mode available.
- Fast, small, safe, embeddable.
- Studio provides: autocompletion, syntax highlighting, static linting, type checking.

### Three Script Types

#### Server Scripts (Script with RunContext = Server)
- Run **only on the server**.
- Have access to `ServerStorage` and `ServerScriptService`.
- Handle authoritative game logic: physics, economy, persistence, anti-cheat.
- The **source of truth** for game state.
- Clients **cannot** see or access server script code or server-only storage.

#### Client Scripts (LocalScript or Script with RunContext = Client)
- Run **only on each player's client**.
- Handle: UI, input, camera, local visual effects, sound.
- Cannot directly modify server state.
- Have access to `Players.LocalPlayer` and client-specific services.

#### Module Scripts (ModuleScript)
- **Reusable code modules** that return exactly one value.
- Loaded via `require()`.
- Run once per Luau environment (cached after first require).
- Can be placed in:
  - `ReplicatedStorage` — accessible by both server and client scripts.
  - `ServerStorage` — accessible only by server scripts.
  - `StarterPlayerScripts` — runs on client.

### Client-Server Communication

Since client and server cannot directly access each other's variables:

- **RemoteEvent**: Fire-and-forget messages. `FireServer()` (client -> server),
  `FireClient()` / `FireAllClients()` (server -> client).
- **RemoteFunction**: Request-response. Client calls server (or vice versa) and waits for a
  return value.
- These must be placed in `ReplicatedStorage` to be accessible by both sides.

### Security Model

- **Server is authoritative** — clients cannot access `ServerStorage` or `ServerScriptService`.
- Exploiters can manipulate client-side code, so **all important logic must be server-side**.
- RemoteEvents are visible to clients (they are in ReplicatedStorage), so the server must
  **validate all incoming remote calls** — never trust client data.
- Best practice: server scripts validate every action, client scripts are purely for
  presentation.

### Data Persistence

- **DataStore** — key-value storage, accessed only from server scripts.
- Standard pattern: load player data on join, save on leave and periodically.
- No file system access — all persistence goes through DataStore API.

### Power Level for Creators

Creators have **extensive power** within the sandboxed environment:
- Full control over game logic, physics, UI, and player interactions.
- Can create custom AI, complex economy systems, procedural generation.
- Access to Roblox services: Physics, TweenService, CollectionService, RunService, etc.
- Can spawn/destroy instances, manipulate the entire Workspace hierarchy.
- Can implement custom networking on top of RemoteEvents.
- **Cannot** access: the OS, file system, network (outside Roblox APIs), or other
  experiences' data.

### Comparison to tilefun's Architecture

| Aspect | Roblox | tilefun |
|--------|--------|---------|
| Language | Luau (typed Lua 5.1) | TypeScript (strict) |
| Server/Client split | Enforced by engine (separate environments) | Enforced by architecture (GameServer/GameClient) |
| Communication | RemoteEvent/RemoteFunction | SerializingTransport (full state broadcast) |
| Script types | Server/Client/Module | Mods (server-side only, Tier 1) |
| Persistence | DataStore (key-value) | IndexedDB (SaveManager) |
| Security boundary | Engine-enforced sandbox | Trust-based (same process) |
| Replication | Automatic instance replication + manual remotes | Manual serialization via spread |
| Mod power | Full Luau within sandbox | WorldAPI facade + Services |

---

## Key Takeaways for tilefun

### Economy Design
1. **Single soft currency with daily caps** (Adopt Me model) is the simplest and most
   kid-friendly approach. Good fit for a 6-year-old's game.
2. **Gems as collectibles** already exist in tilefun — this maps to Adopt Me's Bucks model.
3. If you want depth later, add a second "premium" currency for rare items (Blox Fruits
   Fragments model).
4. **Developer products** (repeatable Robux purchases) are how most Roblox games monetize
   currency — worth understanding but not relevant for a personal project.

### Plot/Land Mechanics
1. **Escalating cost curves** are universal — each plot expansion costs more than the last.
2. **Visible locked areas** ("LAND FOR SALE!" signs) create aspiration.
3. The **dropper/tycoon pattern** (earn -> invest -> earn more -> expand) is the core loop.
4. For tilefun: chunk-based terrain + a "buy adjacent chunks" mechanic with gem costs would
   map naturally.

### Ownership
1. Roblox has **no platform-level plot ownership** — it is 100% game logic using DataStore.
2. For tilefun: ownership of areas/builds within a realm is a game-level concern, not an
   architectural one. IndexedDB persistence already supports this.

### Housing/Interior Pattern
1. **Client-side visibility culling** (parent to/from ReplicatedStorage) is the standard
   Roblox pattern for housing.
2. For tilefun: the multi-world/realm system already provides this — a "house" could be a
   separate world/layer that the player portals into.

### Scripting
1. tilefun's mod system (WorldAPI + Services) is conceptually similar to Roblox's
   server-side scripts.
2. Roblox's CollectionService = tilefun's TagService. RunService = TickService. Touched =
   OverlapService.
3. The key difference: Roblox has a hard client/server sandbox boundary enforced by the
   engine. tilefun runs in a single process, so the boundary is architectural, not enforced.

---

## Sources

- [Roblox Experience Ownership Transfer](https://create.roblox.com/docs/projects/experience-ownership-transfer)
- [Roblox Place (Wiki)](https://roblox.fandom.com/wiki/Place)
- [Brookhaven Houses (Wiki)](https://official-brookhaven.fandom.com/wiki/Houses)
- [Adopt Me Houses (Wiki)](https://adoptme.fandom.com/wiki/Houses)
- [How to Implement a Housing System (DevForum)](https://devforum.roblox.com/t/how-to-implement-a-housing-system/337080)
- [Roblox Monetization Guide 2025](https://boostroom.com/blog/monetization-for-creators-gamepasses-dev-products)
- [How to Make Money on Roblox 2026](https://www.eneba.com/hub/play-to-earn/how-to-make-money-on-roblox/)
- [Roblox Economic Impact Report 2025](https://about.roblox.com/newsroom/2025/09/roblox-annual-economic-impact-report)
- [Roblox Rewarded Video Ads 2026](https://www.gamebizconsulting.com/blog/roblox-ad-monetization-guide-2026)
- [Roblox Business Model 2026](https://macrohint.com/roblox-business-model-2026-how-the-platform-makes-money/)
- [Adopt Me Bucks (Wiki)](https://adoptme.fandom.com/wiki/Bucks)
- [Blox Fruits Money (Wiki)](https://blox-fruits.fandom.com/wiki/Money)
- [Blox Fruits Fragments (Wiki)](https://blox-fruits.fandom.com/wiki/Fragments)
- [Pet Simulator 99 Currencies (Wiki)](https://pet-simulator.fandom.com/wiki/Currencies_(Pet_Simulator_99))
- [Theme Park Tycoon 2 Plot Expansions (Wiki)](https://tpt2.fandom.com/wiki/Plot_expansions)
- [Lumber Tycoon 2 Land (Wiki)](https://lumber-tycoon-2.fandom.com/wiki/Land)
- [New Publishing Requirements Dec 2025 (DevForum)](https://devforum.roblox.com/t/new-requirements-to-publish-and-update-public-experiences/4143953)
- [Roblox Content Moderation](https://en.help.roblox.com/hc/en-us/articles/21416271342868-Content-Moderation-on-Roblox)
- [How Roblox Uses AI for Moderation](https://about.roblox.com/newsroom/2025/07/roblox-ai-moderation-massive-scale)
- [Roblox Luau Documentation](https://create.roblox.com/docs/luau)
- [Roblox Scripts Documentation](https://github.com/Roblox/creator-docs/blob/main/content/en-us/scripting/scripts.md)
- [Creator Store (Wiki)](https://roblox.fandom.com/wiki/Creator_Store)
- [Sell on Creator Store (Docs)](https://create.roblox.com/docs/production/sell-on-creator-store)
- [Roblox Creator Tools 2025](https://www.thespike.gg/roblox/beginner-guides/roblox-creator-tools)
- [Roblox Revenue Split Discussion (DevForum)](https://devforum.roblox.com/t/creator-earnings/2230282)
