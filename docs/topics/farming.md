# Farming

Topic: farming
Status: first playable garden and woodlot
Updated: 2026-11-21

Open **Map**, select a 🌽 farm and choose **Travel to selected point**. The
first farm button also works when the destination is outside the visible map.
The farm lane links to an existing road. The arrival is next to the beds.

Use **E**, controller **Y**, or the on-screen action in Play.

- Plant corn in an empty bed. The sprout ripens in one minute, including while
  away. One watering brings the remaining wait down to at most 15 seconds.
  Ripe corn stays on the stalk until picked.
- Harvest puts one ear in the acting player's basket. At the feeder, one ear
  scatters corn for the local Buff hens to approach and peck.
- Chop a small woodlot tree three times, then walk over the fallen logs. Bring
  one bundle to the fence stakes to add a solid fence panel. Interact with a
  stump to plant the tree again after collecting the wood.
- In Build, place beds, feeders, Buff hens, woodlot trees and fence stakes under
  Entities. A finished Garden fence is under Props and costs nothing in Build.

The outdoor authority validates the seat, reach, current action, usable ground,
and material cost. Farm actors use world persistence and the ordinary actor
stream. The bed stores an absolute ripening deadline. Garden actors have stable
regional identities that can be admitted in visited chunks. The player basket
follows the player's save across the overworld and its interiors, with separate
baskets for separate worlds and seats. The same crop, log bundle or stake can
only pay out once per use.

Existing farmsteads retain their original placement. There is also one
outskirts farm per settlement where the road, dry land and competing regional
plans allow it. The Map queries the same planner as the terrain generator. The
search for an offscreen destination is bounded, so worlds without a qualifying
farm nearby can be explored by panning and zooming out.

[Workshop garden layout](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-town-farm&landscape=thicket#/tool/world-geometry)
