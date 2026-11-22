# Farming

Topic: farming
Status: garden, woodlot, hotbar and chicken handling in Play
Updated: 2026-11-21

Open **Map**, select a 🌽 farm and choose **Travel to selected point**. The
first farm button also works when the destination is outside the visible map.
The farm lane links to an existing road. The arrival is next to the beds.

Use **E**, controller **Y**, or the on-screen action in Play.

- Plant corn in an empty bed. The sprout ripens in one minute, including while
  away. One watering brings the remaining wait down to at most 15 seconds.
  Ripe corn stays on the stalk until picked.
- Harvest puts an ear of corn in the acting player's four-slot hotbar. Tap a slot
  to hold its item, then tap it again to put it away. **[ / ]** or controller
  **D-pad Left / Right** cycle through the occupied slots and empty hands.
  The local keyboard guest uses **- / =**. In shared-screen and split-screen
  co-op, click or tap a filled slot in either player's hotbar to select it for
  that player. Each hotbar shows its own shortcut hints.
- Hold corn near Buff hens and they'll follow. Use **Scatter corn** beside the
  flock to feed them on clear ground. The farm sign marks the pen.
- Use **Open gate** and **Close gate** in Play. Walk slowly with corn to lead
  the hens through. Put the corn away after moving them and they can settle
  around their new location. A closed gate blocks movement, and a hen or
  player in the opening holds it open.
- Chop a small woodlot tree three times, then walk over the fallen logs. Bring
  one bundle to the fence stakes to add a solid fence panel. Interact with a
  stump to plant the tree again after collecting the wood.
- In Build, place beds, pen signs, Buff hens, woodlot trees and fence stakes under
  Entities. Garden fences and gates are under Props and cost nothing in Build.

The outdoor authority validates the seat, reach, current action, usable ground,
and material cost. Farm actors use world persistence and the ordinary actor
stream. The bed stores an absolute ripening deadline. Garden actors have stable
regional identities that can be admitted in visited chunks. Hotbar slots and
selection save per player and world and follow them indoors. Existing corn and
wood baskets migrate into stacks. Other players can see the equipped item.
A crop, log bundle or stake pays out once per use. The authoritative prop store
persists gate position and state, and hens use ordinary fauna movement and
collision while following a player.

The next farm slice can use these systems for rooster-dependent fertile eggs,
chicks and a town stand that residents can visit.

Existing farmsteads retain their original placement. There is also one
outskirts farm per settlement where the road, dry land and competing regional
plans allow it. The Map queries the same planner as the terrain generator. The
search for an offscreen destination is bounded, so worlds without a qualifying
farm nearby can be explored by panning and zooming out.

[Workshop garden layout](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-town-farm&landscape=thicket#/tool/world-geometry)
