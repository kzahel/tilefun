# Riding diagnostics

Current entry points checked 2026-10-03. The
[original investigation](archive/riding-debug-investigation.md) preserves earlier
fixes and snapping hypotheses. Those symptoms have not been reproduced by this
documentation cleanup; they are not a confirmed current bug list.

## Follow the shared movement path

1. [EntityHandle / PlayerHandle](../src/server/EntityHandle.ts) owns mount/dismount
   state. Inspect the session mount ID, parent ID, local offsets and ridden AI state.
2. [Realm](../src/server/Realm.ts) consumes queued input using shared
   `stepMountFromInput` and tracks already-stepped entities so normal updates do
   not move the mount again.
3. [PlayerMovement](../src/physics/PlayerMovement.ts) owns mount input and stepping;
   [SimulationEnvironment](../src/physics/SimulationEnvironment.ts) builds the
   query context shared with prediction.
4. [EntityManager](../src/entities/EntityManager.ts) resolves parented world
   positions. Ridden entities must stay eligible for simulation.
5. [PlayerPredictor](../src/client/PlayerPredictor.ts) predicts the mount and rider,
   reconciles authoritative state and replays unacknowledged input. Compare
   authoritative/predicted state before blaming render interpolation.
6. [RealmReplicator](../src/server/RealmReplicator.ts) explicitly includes the
   mount; [serialization](../src/shared/serialization.ts) carries parenting state.
   The client maintains replica entities and previous/current render state.

## Reproduce before changing behavior

Record the host mode (Worker, P2P or dedicated), generator/seed, mount type,
input sequence and whether divergence occurs in physics or presentation. Check
acknowledged input sequence and double-stepping first; don't revive an old
hypothesis merely because the symptom looks similar.

Start with [input queue tests](../src/server/InputQueuePrediction.test.ts),
[netcode parity](../src/server/NetcodeParityBaseline.test.ts),
[predictor tests](../src/client/PlayerPredictor.test.ts) and
[physics parity](../src/physics/physicsParity.test.ts). Use the repository's
instrumentation or gameplay runner for timing-sensitive evidence before manual
UI operation. [Prediction lessons](hard-won-knowledge.md) records earlier clock
and input-consumption findings; [physics](3D-PHYSICS-DESIGN.md) owns current shape.
