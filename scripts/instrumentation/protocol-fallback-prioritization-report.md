# JSON Fallback Prioritization Report (tilefun)

Scope reviewed:
- `/Users/kgraehl/code/tilefun/src/shared/protocol.ts`
- `/Users/kgraehl/code/tilefun/src/shared/binaryCodec.ts`
- Send/use paths in client/server/transports.

Date: 2026-02-17

## Findings (ordered by impact)

1. `editor-cursor` (client->server) and `sync-editor-cursors` (server->client) are the strongest remaining active-path JSON candidates.
- Runtime measurement (2 clients, editor activity):
  - `editor-cursor`: 40 msgs, avg 88.0B, total 3520B.
  - `sync-editor-cursors`: 42 msgs, avg 151.9B, total 6380B.
- Source paths:
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:27`
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:231`
  - `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1321`
  - `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1334`

2. `sync-props` remains the largest burst-style JSON payload.
- Runtime measurement: 4 msgs, avg 3485.0B, max 6937B, total 13940B.
- Sample measurement: `sync-props-40 = 7383B`.
- Source paths:
  - `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1298`
  - `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1305`

3. Editor mutation uplink (`edit-*`) is still all JSON; each op is small but can become bursty.
- Sample sizes: ~66B-118B each (`edit-elevation`..`edit-terrain-subgrid`).
- Source paths:
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:112`
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:130`
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:143`
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:155`
  - `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:166`

4. World/lobby/admin request-response traffic is generally low frequency.
- Medium/large sizes exist (`world-list-20=2609B`, `realm-list-20=2659B`) but usually user-action bound.
- Source paths:
  - `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:503`
  - `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:537`
  - `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:692`
  - `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:698`

## Instrumentation and Measurement Evidence

Temporary instrumentation added in-repo:
- `/Users/kgraehl/code/tilefun/scripts/instrumentation/protocol-fallback-audit.ts`
- `/Users/kgraehl/code/tilefun/scripts/instrumentation/protocol-fallback-size-samples.ts`

Runtime (`protocol-fallback-audit.ts`) observed JSON fallback totals:

```text
SERVER_JSON_STATS
sync-props            count=4   avg=3485.0 min=33 max=6937 total=13940
sync-editor-cursors   count=42  avg=151.9  min=50 max=158  total=6380
sync-cvars            count=2   avg=255.0  min=255 max=255 total=510
sync-session          count=4   avg=84.5   min=84 max=85   total=338
sync-player-names     count=2   avg=75.0   min=75 max=75   total=150
realm-player-count    count=2   avg=64.0   min=64 max=64   total=128
realm-joined          count=1   avg=101.0  min=101 max=101 total=101
world-loaded          count=1   avg=87.0   min=87 max=87   total=87
player-assigned       count=2   avg=40.0   min=40 max=40   total=80
realm-list            count=1   avg=34.0   min=34 max=34   total=34

CLIENT_JSON_STATS
editor-cursor         count=40  avg=88.0   min=87 max=89   total=3520
edit-spawn            count=40  avg=68.8   min=67 max=70   total=2754
set-editor-mode       count=4   avg=42.5   min=42 max=43   total=170
join-realm            count=1   avg=60.0   min=60 max=60   total=60
```

Sample-size script (`protocol-fallback-size-samples.ts`) highlights:

```text
Client samples
editor-cursor=89B, visible-range=67B, player-interact=50B,
edit-terrain-subgrid=118B, edit-terrain-tile=98B, edit-road=73B,
edit-elevation=66B, throw-ball=52B

Server samples
sync-props-1=217B, sync-props-40=7383B
sync-editor-cursors-1=159B, sync-editor-cursors-8=865B
sync-player-names-2=75B, sync-player-names-16=299B
sync-cvars=245B
world-list-20=2609B, realm-list-20=2659B
```

## Inventory: Remaining JSON-fallback Message Types

Legend:
- Frequency: `very low`, `low`, `low/med`, `med`, `high`
- Size: `small`, `medium`, `large` with byte estimates from measured samples where available.

| Type | Direction | Trigger | Expected Frequency | Payload Size | Latency Sensitivity | Evidence |
|---|---|---|---|---|---|---|
| player-interact | C->S | click/tap interact | low/med | small (~50B) | high | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:974` |
| edit-terrain-tile | C->S | tile paint | med burst | small (~98B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:112` |
| edit-terrain-subgrid | C->S | subgrid paint | med burst | medium (~118B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:130` |
| edit-terrain-corner | C->S | corner paint | med burst | small (~102B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:143` |
| edit-road | C->S | road paint | med burst | small (~73B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:155` |
| edit-elevation | C->S | elevation paint | med burst | small (~66B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:166` |
| edit-spawn | C->S | place entity/prop | med burst | small (~67-70B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:177` |
| edit-delete-entity | C->S | delete entity | low | small (~45B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:187` |
| edit-delete-prop | C->S | delete prop | low | small (~41B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:192` |
| edit-clear-terrain | C->S | clear terrain | very low | small (~44B) | low | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:198` |
| edit-clear-roads | C->S | clear roads | very low | small (~28B) | low | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:201` |
| set-editor-mode | C->S | enter/exit mode | low | small (~42-43B) | medium | `/Users/kgraehl/code/tilefun/src/scenes/PlayScene.ts:111` |
| set-debug | C->S | debug toggle | low | small (~51B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:759` |
| visible-range | C->S | camera chunk range change | low/med | small (~67B) | medium | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:745` |
| flush | C->S | unload/menu/background | very low | small (~17B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:733` |
| invalidate-all-chunks | C->S | debug renderer mode change | very low | small (~33B) | low | `/Users/kgraehl/code/tilefun/src/scenes/PlayScene.ts:192` |
| load-world | C->S | legacy request path | currently none in app | small (~67B) | medium | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:626` |
| create-world | C->S | menu action | low | small (~97B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:503` |
| delete-world | C->S | menu action | low | small (~69B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:537` |
| list-worlds | C->S | legacy request path | currently none in app | small (~39B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:717` |
| rename-world | C->S | menu action | low | small (~92B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:554` |
| rcon | C->S | admin console | low | small (~61B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:186` |
| editor-cursor | C->S | editor cursor move/tool change | high (20Hz cap) | small (~87-89B) | med/high | `/Users/kgraehl/code/tilefun/src/scenes/EditScene.ts:27` |
| throw-ball | C->S | throw release | low/med | small (~52B) | high | `/Users/kgraehl/code/tilefun/src/scenes/PlayScene.ts:279` |
| identify | C->S | initial connect | very low | small (~76B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:303` |
| list-realms | C->S | lobby/menu | low | small (~39B) | low | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:692` |
| join-realm | C->S | world join | low | small (~60-67B) | medium | `/Users/kgraehl/code/tilefun/src/client/GameClient.ts:256` |
| leave-realm | C->S | protocol present; no app sender found | currently none in app | small (~39B) | medium | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:682` |
| player-assigned | S->C | connect/rejoin/join | low | small (~40B) | high | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:177` |
| kicked | S->C | duplicate login/tab | very low | small (~56B) | high | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:603` |
| sync-session | S->C | gems/editor/mount changed | low/med | small (~84-85B) | medium | `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1252` |
| sync-invincibility | S->C | invincibility start/reset | low | small (~65B) | medium | `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1269` |
| sync-props | S->C | prop revision/range changed | low burst | large (33B..7.4KB) | medium | `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1298` |
| sync-cvars | S->C | physics cvar revision changed | very low | medium (~245-255B) | low | `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1339` |
| sync-player-names | S->C | player set/name changes | low | small/medium (~75-299B) | low | `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1311` |
| sync-editor-cursors | S->C | editor cursor revision | med/high in collab edit | medium (~50-865B observed) | med/high | `/Users/kgraehl/code/tilefun/src/server/Realm.ts:1321` |
| world-loaded | S->C | connect/load response | low | small/medium (~87-110B) | high | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:181` |
| world-created | S->C | create response | low | medium (~185B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:701` |
| world-deleted | S->C | delete response | low | small (~39B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:711` |
| world-list | S->C | list response | low | medium/large (~186-2609B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:720` |
| world-renamed | S->C | rename response | low | small (~39B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:730` |
| rcon-response | S->C | admin command output | low | small/medium (~62-241B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:747` |
| realm-list | S->C | lobby list response/broadcast | low | medium/large (~34-2659B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:647` |
| realm-joined | S->C | join response | low | small/medium (~101-110B) | high | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:668` |
| realm-left | S->C | leave response | low | small (~36B) | medium | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:693` |
| realm-player-count | S->C | join/leave broadcast | low | small (~64-69B) | low | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:553` |
| chat | S->C | chat broadcast | low/med | small (~57B) | medium | `/Users/kgraehl/code/tilefun/src/server/GameServer.ts:562` |

## Prioritization

1. `editor-cursor` (C->S)
- Estimated savings: ~88B -> ~9-11B (~87-90%).
- Complexity/risk: low.
- Recommendation: **do now**.

2. `sync-editor-cursors` (S->C)
- Estimated savings: ~40-70% depending on cursor count and string strategy.
- Complexity/risk: medium.
- Recommendation: **do now** if collaborative editor usage matters; otherwise **later**.

3. `sync-props` (S->C)
- Estimated savings: large on bursts (roughly multi-KB reductions per large update).
- Complexity/risk: medium/high.
- Recommendation: **later**.

4. Terrain edit family (`edit-terrain-*`, `edit-road`, `edit-elevation`, optional `edit-spawn`)
- Estimated savings: ~75-90% per op in paint bursts.
- Complexity/risk: medium.
- Recommendation: **later**.

5. World/admin/lobby messages
- Savings: low overall due low frequency.
- Complexity/risk: low but weak ROI.
- Recommendation: **not worth it now**.

## Implementation Sketch (Top 1-2)

### 1) `editor-cursor` (client->server)

- Proposed tag: `0x81`.
- Encoding:
  - `tag:u8`
  - `tileX:i16`
  - `tileY:i16`
  - `editorTab:u8` (enum index)
  - `brushMode:u8` (enum index)
- Compatibility/fallback:
  - Keep existing JSON fallback (`0xFF`) for unknown enum values/out-of-range.
  - Decoder accepts both binary and JSON for compatibility.
- Tests:
  - Binary roundtrip.
  - Unknown enum -> JSON fallback.
  - Coordinate bounds behavior.

### 2) `sync-editor-cursors` (server->client)

- Proposed tag: `0x04`.
- Encoding:
  - `tag:u8`
  - `count:u8`
  - Repeated entries:
    - `tileX:i16`, `tileY:i16`
    - `editorTab:u8`, `brushMode:u8`
    - `nameLen:u8`, `nameUtf8`
    - `colorLen:u8`, `colorUtf8`
- Compatibility/fallback:
  - Use JSON fallback when entry count/string lengths exceed limits.
  - Decoder supports both binary and JSON.
- Tests:
  - Roundtrip for 0/1/N entries.
  - Truncation/reject on malformed lengths.
  - Fallback path coverage.

## Recommendation and Next Steps

1. Implement `editor-cursor` binary first.
2. Implement `sync-editor-cursors` binary next if collaborative editing is a priority.
3. Re-run `/Users/kgraehl/code/tilefun/scripts/instrumentation/protocol-fallback-audit.ts` after each change to confirm net byte reduction.
4. Re-evaluate whether `sync-props` moves from **later** to **do now** based on measured prop-heavy sessions.
