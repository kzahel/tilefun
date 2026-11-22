# 267 Farm chicken life cycle

Owner requested a rooster, eggs that can hatch while a rooster is present and
the pen has capacity, breakable eggs, and chicks that grow up. This slice adds
original four-direction rooster and chick sprites to the farm as provisional
gameplay art. The existing Buff hen uses its current bank.

The shared regional farm planner gives each chicken pen a stable rooster ID.
Older regions receive the addition through the existing garden actor admission
path. An intentionally removed rooster stays removed. The same authority tick
owns egg laying, the shared pen count, hatching, chick growth and broken shells
for solo play and local or online co-op. Eggs remain non-solid. A spawn checks
the same terrain and prop collision used by the farm.

The horizontal and side fence pieces are both available in Build, and fence
stakes name the wood bundle needed in Play. [Farming](../topics/farming.md)
owns the timings and play instructions.

The Workshop's **Farm chicken life cycle** batch registers the new draft
art together in a gameplay view. [Chicken pen review](https://tilefun.graehlarts.com/tilefun/workshop.html?geometry=nature-chicken-pen&landscape=thicket#/tool/world-geometry).

Native checks cover fertility, rooster presence at hatch, the shared pen cap,
saved egg state, egg breaking and chick growth. Chromium verified the rooster at
a generated town farm, breaking a fertile egg through the touch action, and the
Workshop pen with all four stages visible. The production build, generated
inventories, typechecks and streaming readiness check passed.
