"""Check meaningful compositor cases independently of the asset hypotheses."""
import numpy as np
from compare import compose, decisions, sample


overlap = np.ones((1, 3), dtype=bool)
object_depth = np.array([[3., np.nan, 9.]])
actor_depth = np.array([[5., 5., 10.]])
ground = np.array([[False, False, True]])
hidden, unresolved = decisions(object_depth, actor_depth, overlap, True, ground)
np.testing.assert_array_equal(hidden, [[False, True, False]])
np.testing.assert_array_equal(unresolved, [[False, True, False]])
# A shared raised receiving surface must not reverse depth order.
raised, uncertain = decisions(object_depth + 24 / np.sqrt(2), actor_depth + 24 / np.sqrt(2),
                              overlap, True, ground)
np.testing.assert_array_equal(raised, hidden)
np.testing.assert_array_equal(uncertain, unresolved)
# Foot-only comparison hides the same pixel that its actual plane puts in front.
foot, _ = decisions(np.array([[3.]]), np.array([[2.]]), np.array([[True]]), False, np.array([[False]]))
plane, _ = decisions(np.array([[3.]]), np.array([[5.]]), np.array([[True]]), False, np.array([[False]]))
assert foot[0, 0] and not plane[0, 0]
# Explicit ground role bypasses missing object depth; alpha holes cannot hide.
h, u = decisions(np.array([[np.nan, 100.]]), np.array([[5., 5.]]),
                 np.array([[True, False]]), True, np.array([[True, False]]))
assert not h.any() and not u.any()
# Original colors and alpha must compose on the correct side, even translucently.
obj = np.zeros((96, 96, 4), dtype=np.uint8)
actor = obj.copy()
obj[10, 10] = [0, 0, 255, 128]
actor[10, 10] = [255, 0, 0, 255]
front = np.array(compose(obj, actor, np.zeros((96, 96), dtype=bool)))
mask = np.zeros((96, 96), dtype=bool)
mask[10, 10] = True
back = np.array(compose(obj, actor, mask))
np.testing.assert_array_equal(front[10, 10], [255, 0, 0, 255])
np.testing.assert_array_equal(back[10, 10], [127, 0, 128, 255])
# Pose placement samples at centers and never wraps out-of-bounds pixels.
pixels, inside = sample(np.array([[17, 23], [42, 51]]), [0, 0], [.5, .5, 0])
assert pixels[72, 48] == 17 and pixels[73, 49] == 51
assert inside.sum() == 4 and not inside[71, 48]
print("Overlap depth, raised translation, invalid fallback, ground roles, alpha and placement pass")
