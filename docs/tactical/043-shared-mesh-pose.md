# 043 — Shared mesh pose and gameplay integration

Status: complete, 2026-10-04. Parent: [039](039-fixed-view-gpu-parent.md).

Attach the optional compact-car mesh to the existing entity presentation, never
a GPU-only entity. Shared SceneFrame owns cosmetic heading smoothing based on
replicated velocity/facing and one frame timestamp. A weak entity-keyed cache
reuses quaternion/instance records and resets on realm change. No authoritative
steering/collision changes. Visual culling conservatively includes mesh rotation.

Keep fixed projection, add inspector yaw/pitch/roll controls via the same neutral
quaternion convention and body path. Test heading wrap, stable storage, reset,
read-only input, and gameplay frame integration. Browser tests use the actual
shared game to confirm a car mesh is submitted when available.

Delivered cosmetic heading smoothing in SceneFrame, weak entity-keyed reusable
poses, conservative mesh culling and local roll/pitch/world yaw convention.
The optional compact-car descriptor is produced by the existing collectScene;
Canvas ignores it, GPU resolves it. Traffic playground selects the same backend
and frame path with `?renderer=gpu&meshes`, preserving its shared ScenarioClient.

An initial test attempted edit-spawn for a vehicle; vehicles are generated traffic
and have no editor spawn factory. No gameplay factory was added just to satisfy a
test. The test now uses the deterministic shared traffic recipe, whose compact car
exercises normal collection and submission. Worker gameplay GPU loading is covered
separately; generated compact cars receive the same presentation descriptor.

Typechecks, 1,443 unit tests, inventories/build and seven GPU/traffic browser tests
passed. Existing stopping, jump/roof riding and touch tests still pass. Inspector
and gameplay use the same GpuMeshBodies adapter. No physical state is changed.
