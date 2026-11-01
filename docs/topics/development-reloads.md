# Player-controlled development reloads

Topic: development-reloads
Status: delivered; live launchd service restarted with manual reloads enabled.
Updated: 2026-10-25.

Owns the live checkout's development update notifications and completion signal.
The server serves current files directly; there are no published snapshots or
retained releases. Production builds have no development notifier.

## Behavior and limits

`npm run dev` disables Vite HMR and its WebSocket entirely. Disabling only HMR
would leave Vite's reconnect-triggered page reload and error channel active.
This applies to the whole dev server, including Workshop/labs, which can still
be refreshed manually. `TILEFUN_AUTO_RELOAD=1` restores ordinary Vite behavior
for a separate development server if desired; no notifier is enabled then.

The Vite watcher observes playable source/public/demo assets and root entry,
package and configuration files. Tests, documentation, private data and reports
do not announce playable updates. On an edit, readiness clears immediately;
after five quiet seconds the game displays **Code changed** without stealing
focus or opening a menu. EventSource carries notifications independently of
Vite's update transport and reconnects after server restarts. A new process
revision offers a manual update rather than reloading the player.

After finishing and validating a feature/fix, agents run `npm run dev:ready`.
This writes the ignored `.tilefun-dev-ready` marker with a unique ID and time.
The watcher immediately announces **Changes ready to try**. Any later playable
edit clears that status, including another agent's edits. The marker has no
approval meaning, never triggers a reload and is not replayed at server startup.

Mouse/touch users can select **Save and reload** in the passive notice. Keyboard
and controller users can select the same action in the main menu. Arrival of a
notice does not take focus. Reload awaits local persistence and Worker shutdown,
preserves existing profile/realm-scoped camera/editor restoration, and closes a
P2P host before navigating. Save failure leaves the page open with a retryable
error. Reloading a P2P host disconnects its guests; dedicated Node authority is
not automatically restarted by this mechanism.

A browser's first connection establishes its baseline, so newly loaded code does
not announce itself as an update. Later revisions remain pending until reload.
The ready marker is advisory: the agent owns checking the feature, and another
edit may race with the player's reload. A five-second quiet period is not proof
of feature completion or successful compilation. Initial page loads can still
fail on broken source, and later lazy imports/assets read the current checkout.
Dependency/configuration edits may restart Vite; single-player's already-running
Worker continues independently, but dedicated multiplayer attached to that
Vite process can disconnect. This is a development comfort feature, not release
isolation or coordinated multiplayer upgrades.

## Code and validation

- `src/server/devUpdatePlugin.ts`: watcher filtering, quiet timer and SSE lifecycle.
- `scripts/dev-ready.mjs`: portable completion marker command.
- `src/ui/DevUpdateNotice.ts`, `src/main.ts`: passive UI and awaited reload.
- `MainMenu` / `GameClient`: shared controller-accessible reload action.

Validation on 2026-10-25: typechecks, three watcher/state/SSE tests, the manual
reload browser boundary and both existing automatic reload/save-restoration
browser cases pass. The manual case covers readiness invalidation, continued
authority ticks through edits and server restart, no forced navigation/overlay,
save failure recovery, and controller-confirmed reload. Production build and
regenerated art/Workshop inventories pass (2,118 candidate identities verified
in full Chromium at retina scale). Focused lint and `git diff --check` pass;
repository-wide lint retains an existing formatting error in
`docs/benchmarks/188-p2p-worker.json`. The full unit run produced no results and
was stopped after about seven minutes with one worker still busy; this checkpoint
does not claim a passing full suite.

The running host uses macOS launchd label `com.graehlarts.tilefun-dev` on port
5174, rather than tmux. Machine-specific runner paths remain outside this repo.

Next: try an ordinary family play session during agent edits and tune notice
placement/quiet time if needed. Snapshots and build-gated publishing remain
outside this implementation.
