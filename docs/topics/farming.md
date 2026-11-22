# Farming

Topic: farming
Status: garden, woodlot, hotbar and the chicken life cycle in Play
Updated: 2026-11-22

Open **Map**, select a 🌽 farm and choose **Travel to selected point**. The
first farm button also works when the destination is outside the visible map.
The farm lane links to an existing road. The arrival is next to the beds.

Use **E**, controller **Y**, or the on-screen action in Play.

- Plant corn in an empty bed. The sprout ripens in one minute, including while
  away. One watering brings the remaining wait down to at most 15 seconds.
  Ripe corn stays on the stalk until picked.
- Every player carries a ball, stick and axe ([269](../tactical/269-held-item-actions.md)).
  Harvest puts an ear of corn in the acting player's eight-slot hotbar. Tap a slot
  to hold its item, then tap it again to put it away. **[ / ]** or controller
  **D-pad Left / Right** cycle through the occupied slots and empty hands (hold to
  keep stepping); **C** or **D-pad Up** swaps back to the last item.
  The local keyboard guest uses **- / =** and **\\**. In shared-screen and split-screen
  co-op, click or tap a filled slot in either player's hotbar to select it for
  that player. Each hotbar shows its own shortcut hints.
- Hold corn near hens, roosters or chicks and they'll follow. Press Use (**Q**,
  controller **X**) or **Scatter corn** beside the hens to feed them on clear ground. The farm sign marks the pen.
- Use **Open gate** and **Close gate** in Play. Walk slowly with corn to lead
  the hens through. Put the corn away after moving them and they can settle
  around their new location. A closed gate blocks movement, and a hen or
  player in the opening holds it open.
- Hold the axe and press Use (**Q**, controller **X**) beside a small woodlot tree
  three times, then walk over the fallen logs. Bring
  one bundle to the fence stakes and use **Build fence**. The wood can stay in
  your hotbar. Leave a step of space between yourself and the stakes so the
  panel fits. Interact with a stump to plant a tree again after collecting wood.
- In **Build → Entities**, place beds, chicken pen signs, hens, roosters, chicks,
  woodlot trees and fence stakes. **Build → Props** offers **Garden fence**,
  **Garden fence (side)** and **Garden gate** for free placement.

## Chickens and eggs

- Generated chicken pens start with three Buff hens and one rooster. The
  chicken pen sign defines the breeding yard. For a custom yard, put the sign
  near the middle of the south edge. Its area measures 136 × 112 world pixels
  and extends 96 pixels north of the sign.
- Visiting the pen starts the hens' laying timers. A hen lays its first egg
  after about 20 seconds and can lay again after another 55 seconds. A pen
  holds up to four unbroken eggs at a time.
- An egg is fertile if a rooster is in the same pen when it is laid. After
  25 seconds the egg can hatch if a rooster is in the pen and the flock has
  fewer than six birds, counting hens, roosters and chicks. Until then, the
  tooltip says what it is waiting for. Use corn to lead some birds out and
  open up space.
- Chicks grow into adults after about one minute, once the adult can fit.
  Use **Break egg** beside any whole egg to leave a little broken shell and
  clear an egg slot. The shell goes away after a few seconds.

The outdoor authority validates the seat, reach, current action, usable ground,
and material cost. Farm actors use world persistence and the ordinary actor
stream. The bed stores an absolute ripening deadline. Garden actors have stable
regional identities that can be admitted in visited chunks. Hotbar slots and
selection save per player and world and follow them indoors. Existing corn and
wood baskets migrate into stacks; four-slot saves pad to eight and gain the
starter tools (holding the ball if their hands were empty). Tools are never
counted or spent. Chopping requires the axe in hand. Other players can see the equipped item.
A crop, log bundle or stake pays out once per use. The authoritative prop store
persists gate position and state, and hens use ordinary fauna movement and
collision while following a player.

Eggs, chicks and laying deadlines persist through saves. Pen checks wait for the
whole yard to load before counting birds or hatching an egg. [Chicken life cycle](../tactical/267-farm-chicken-life-cycle.md).

Existing farmsteads retain their original placement. There is also one
outskirts farm per settlement where the road, dry land and competing regional
plans allow it. The Map queries the same planner as the terrain generator. The
search for an offscreen destination is bounded, so worlds without a qualifying
farm nearby can be explored by panning and zooming out.

[Workshop garden layout](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-town-farm&landscape=thicket#/tool/world-geometry)
