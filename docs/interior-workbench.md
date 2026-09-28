# Indoor Workbench

Open `/tilefun/interior-workbench.html` on the running site. The Interiors atlas catalog also links to it.

The fixture menu contains the small, large, strange, and offset apartment examples. Duplicate a fixture to make a named custom copy. The floor plan and rendered tiles are shown side by side on wide screens. On narrow screens, the Plan and Render buttons switch between views; Split stacks both. Zoom changes both canvases, and Center moves to the selected place or first visible part of the fixture.

## Tools

- **Plan paint:** choose a room, wall, door, or empty-space brush. Drag to paint cells or select Rectangle to fill a zone. A valid sketch recompiles immediately. If the sketch is temporarily invalid, the status shows the parser error and the rendered view clears until it is valid again. The full sketch is also editable as text.
- **Tile paint:** choose a layer and atlas tile, then paint individual 16-pixel rendered cells. These are saved as visual overrides; they do not change the semantic floor plan or collision.
- **Flag:** tap a tile or drag an area in either view, choose the issue type, and write why the placement is wrong. Each flag saves the coordinates, area, plan character, semantic cell, and original generated tile keys. Flags remain separate from painted overrides.
- **Inspect:** tap either view to see the matching plan and rendered coordinates, generated layers, and any override. Selecting a generated tile key makes it the tile brush.
- **Pan:** drag the active canvas. Native scrolling also works; zoom buttons change the pixel scale.

Changes save automatically in that browser. **Export** downloads one JSON document containing the sketch, overrides, and flags. **Import** restores a document from that file. Use Export to share a fixture for review; browser-local changes are not synchronized with the game server.

The current workbench is an architectural editing and review surface. A playable indoor scene with collision and portal transitions remains a separate step.
