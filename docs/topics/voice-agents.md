# Voice agents and child-directed development

Topic: voice-agents
Status: proposed; builder-agent experiment is the preferred direction to explore.
Updated: 2026-10-03.

Owns the idea of a pre-literate player using speech to direct an agent, either
inside the world or through actual development of the game. This records the
project owner's discussion on 2026-10-03, not an implementation commitment or
authorization for agents to execute existing feedback automatically.
[Play ideas](play-ideas.md) continues to own the delivered feedback feature.

## Intent and two modes

The ambition is to give the child the same describe, discuss, implement and try
loop the parent already uses with a coding agent, through speech and the game
instead of a development interface. The child describes desired play; the agent
handles routine engineering decisions and asks brief questions about intent
when needed. Subscription-backed model access is an integration direction,
independent of how much authority either mode receives.

### Companion NPC

A special character defaults to following the player. The child talks to it;
it responds briefly through chat bubbles and potentially speech. A custom
harness offers game actions such as movement direction, entity interaction
and navigation. Waypoints and scripted skills could improve its ability to
play without expecting the model to control every simulation tick.

One extension would let it edit its own behavior plugin or compile JavaScript
through a restricted interface, without general filesystem access. The agent
would create behavior that the game executes locally. The exact language,
execution isolation, resource limits and persistence contract remain open.

### Builder agent

This is the owner's more interesting initial direction: a submitted idea starts
an actual development session. Its context explains that a child is currently
playing, supplies the request and game context, and asks the agent to implement
a reasonable interpretation or ask a clarifying question. It can inspect and
edit the project, validate changes, and make them playable.

The interface simplifies creating sessions, discussing gameplay tradeoffs and
trying implementations. It need not restrict all requests to a predefined game
tool catalog. Follow-up feedback should continue the relevant session so that
"they're too fast" refers to the behavior just implemented.

The owner is willing to accept some odd or imperfect features in this family
experiment, then triage, improve or revert their commits later. These modes
could eventually share an in-world character, but they have different tool
and authority boundaries; a companion does not automatically gain the builder's
project access.

## Current evidence and foundations

- The owner already develops while the child plays with dev auto-reload. It is
  somewhat disruptive but works fairly well, especially for small changes.
  On 2026-10-03 the owner observed a JavaScript compile-error overlay remain on
  the game screen between an agent's edits. This is reported play evidence,
  not an independently reproduced failure.
- [Play ideas](play-ideas.md) already captures a transcript, screenshot and game
  context, with readback and delivery to the private Workshop inbox. It does
  not create agent sessions or provide a clarification/reply channel. Its
  public submission endpoint is not authorization to edit the project.
- [Gameplay scripting](../SCRIPTING-API-DESIGN.md) and
  [WorldAPI](../../src/server/WorldAPI.ts) expose entity/terrain operations,
  tags, events and simulation hooks. Existing mods are trusted host code;
  neither WorldAPI nor the server Worker is an untrusted-code sandbox.
  Arbitrary mod state and API mutations do not automatically acquire durable
  storage or editor undo.
- The sibling `aitutor` checkout is a concrete harness reference. Start with
  its `docs/topics/durable-agents.md`, `runtime/coordinator.py`,
  `runtime/providers/codex_subscription.py`, and
  `scripts/codex_transport_spike/runtime.mjs`. At this discussion's inspection,
  its local development adapter used pinned `@openclaw/ai` transport inside an
  application-owned tool loop, supplying application context and offered tools
  without starting a full Codex App Server session. Its documented replay
  workaround and credential lifecycle limits need rechecking before reuse.
  Pi harness research is in `docs/plans/T-001/pi-harness-research.md`; it is
  research evidence, not proof that Tilefun has an integrated Pi runtime.

## Proposed interaction and delivery

An illustrative conversation: "Make cows eat the trees" → "The whole tree or
just its leaves?" → "Leaves, then they grow back" → implementation → "They're
eating too fast!" The example is invented, not a stored child's submission.

Clarifications should concern visible behavior the child can understand.
Routine implementation choices belong to the agent. Pointing or selecting an
entity could resolve "this one"; short spoken responses and visible changes
should make reading optional. Cancellation and correction need to invalidate
pending work appropriately, as well as preserve useful session context.

Keep the current live-development loop as the baseline for an initial trial.
An explicit "try the new version" button was suggested in discussion, but is
not a decided requirement. First investigate how to avoid showing intermediate
broken builds while retaining quick updates. Possible approaches include
keeping the last working build playable until validation succeeds or applying
coherent edits together; no delivery mechanism has been selected.

For later triage, associate each request/session with its original context,
clarifications, implementation summary, validation results and commits. Keep
private child records outside Git. Reverting code does not necessarily reverse
saved-world mutations; preserving save compatibility and making experiments
easy to disable are proposed constraints for the first trial. Existing immutable
asset/generator and human art-review contracts still apply.

## Next experiment and open questions

The next logical step is a bounded, parent-enabled builder trial using the
existing voice submission and live development setup, with a way to ask and
answer a short clarification. Decide its session routing and authority before
connecting submissions to execution; do not automatically drain the anonymous
feedback inbox into a privileged agent.

Observe whether the child enjoys asking, waiting, trying and refining, and
record disruption from reloads or intermediate compile errors. Questions for
that slice include session continuity, concurrent requests, when changes become
visible, which checks gate updates, recovery from failed work, and how much
parent involvement is useful. Companion navigation and generated behavior
plugins remain separate possibilities rather than prerequisites.
