# Fresh volume-preserving jellyfish prototype

Separate roster-v2 identity under tactical 140. An empty Blender scene owns
a closed 16-sector, six-ring bell, four internal organ marks, eight five-link
rim tendrils and four three-link oral arms. No historical jellyfish source or
pixels are read. The source uses the shared 10px/world-unit camera, a 32px
cell and (16,24) anchor. This is stylized game animation, not measured biology.

The bell genuinely deforms in Blender: independent radial and height shape
keys use factors r and 1/r^2, preserving the closed mesh's volume. No object
scale or whole-image squash is animated. Saved float phase/amplitude channels
drive the deformation; the source's initial integer-property bug was caught
and corrected before registration. Intermediate source keys carry the actual
rim attachments and separately articulated trailing arms through the pulse.
Thirty-two pulse poses span 1.28s; an eight-pose action varies the pulse and
oral-arm curl. Every loop returns to its initial evaluated geometry.

Pixel finishing projects the evaluated bell vertices and shared surface
palette/topology, then draws independent source tendrils and internal marks.
Pale opaque palette planes suggest translucency while retaining binary alpha.
Four-facing native/enlarged strips were inspected; the bell widens/flattens
and slender tendrils trail behind it. Native details remain small by design.

Independent saved-source evidence covers 129 pulse and 33 action samples per
facing, 648 closed volume checks, 208 manifold edges and 17,056 fixed arm links.
Maximum relative bell volume error is below .000008%; interpolated link gap
is below .0005 native px and rim attachment gap below .009px. Native silhouette
width must vary by at least 2px in each facing; evaluated bell width varies
2.86-2.92px. Local basis meshes and object scales remain unchanged while the
bell's evaluated skin deforms. Replay and full Chromium comparisons are
required before registration. Exact finished art remains pending human review.

WILDLIFE_OUTPUT_DIR optionally isolates draft output; normal final output is
public/demos/wildlife-v2/jellyfish/roster-v2. Ordinary builds use committed assets.
