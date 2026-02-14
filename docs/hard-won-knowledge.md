# Hard-Won Knowledge

## Client-Side Prediction Jitter on High Refresh Rate Displays

**Date**: Feb 2025
**Symptom**: Player character jitters/stutters when moving at constant velocity. Most visible on 120Hz+ displays.
**Root cause**: Two independent 60Hz clocks (client RAF accumulator vs server setInterval) drifting, combined with server moving the player on ticks with no client input.

### The Setup

- Client update: 60Hz fixed timestep via `requestAnimationFrame` + accumulator
- Server tick: 60Hz via `setInterval`
- Display: 120Hz (RAF fires at 120Hz, update runs every other frame)
- Transport: `SerializingTransport` (same process, JSON serialization, simulates network boundary)
- Client-side prediction: client predicts player movement locally, reconciles when server state arrives

### Bug 1: Input Overwrite (single-slot `latestInput`)

`PlayerSession` stored only the most recent input. When timing jitter caused 2 client ticks between server ticks, the first input was overwritten and lost. The server processed 1 input, the client predicted 2. Reconciliation snapped the player backward by one tick of movement.

**Fix**: Replace `latestInput: Movement | null` with `inputQueue: Movement[]`. Server drains the full queue each tick, processing each input as a separate movement step. `lastProcessedInputSeq` is updated per consumed input (not on message arrival).

### Bug 2: Phantom Movement on Empty Queue

Even after the queue fix, the server still moved the player on ticks with an empty queue. `EntityManager.update()` always runs and advances the player using whatever velocity was set previously. But the client didn't predict any movement for that tick (it only predicts when it sends an input). This created 1 full tick of drift every time timing jitter caused a "0 inputs then 2 inputs" pattern.

**Fix**: Zero the player's velocity when the input queue is empty, so `EntityManager.update()` computes dx=dy=0 and doesn't advance the player.

### The Invariant

**The server must move the player exactly N times for N inputs received.** No more (phantom movement on empty ticks), no less (dropping inputs). This ensures the server and client predictions stay in perfect sync for deterministic movement.

### Source Engine Reference

We studied the Source Engine prediction code at `~/code/reference/source-engine` to understand the architecture. Key takeaways:

- **Command rate != frame rate**: Source decouples render FPS from input rate (`cl_cmdrate`). The client renders at arbitrary FPS but creates commands at a fixed rate close to the server tick rate.
- **Server processes ALL commands**: Commands are queued and processed in order, never dropped. Each gets a fixed `TICK_INTERVAL` dt.
- **Rate limiting**: `sv_maxusrcmdprocessticks` caps the accumulated time budget per player to prevent speedhacking.
- **Error smoothing**: `NotePredictionError()` accumulates a visual offset that decays exponentially. Small mispredictions are smoothed rather than snapped. We didn't need this for the constant-velocity case (the queue fix eliminated the prediction error entirely), but it would help for cases where collision diverges between client and server.
- **Per-command state storage**: `StorePredictionResults()` saves predicted state for each command number, enabling precise error measurement. Our approach (snap + replay all unacked) is simpler but equivalent for our use case.

### Key Files Changed

- `src/server/PlayerSession.ts` — `latestInput` → `inputQueue`
- `src/server/GameServer.ts` — queue processing in `tick()`, velocity zeroing on empty queue, `lastProcessedInputSeq` set on consumption not arrival
- `src/client/PlayerPredictor.ts` — unchanged (was already correct)

### Testing Strategy

The timing jitter is inherently non-deterministic (RAF vs setInterval drift), but the fix can be tested deterministically by manually controlling when inputs arrive and when the server ticks:

1. Send 2 inputs, then tick once → verify both are processed and position matches 2 ticks of movement
2. Send 0 inputs, then tick once → verify player doesn't move
3. Alternate patterns (0-2-1-0-2) → verify cumulative position matches total input count
4. Compare server position with client predictor position after reconciliation → verify zero error
