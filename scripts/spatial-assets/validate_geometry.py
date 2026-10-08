"""Reject synthetic cards, floors and boxes without rejecting a rounded volume."""
import trimesh
from geometry_checks import geometry_checks

box = trimesh.creation.box()
box_result = geometry_checks(box.vertices, box.faces)
assert box_result["boundaryBoxSurfaceAreaFraction"] > .99
ball = trimesh.creation.icosphere(subdivisions=3)
ball_result = geometry_checks(ball.vertices, ball.faces)
assert ball_result["axisExtentRatio"] > .99
assert ball_result["boundaryBoxSurfaceAreaFraction"] < .1
assert ball_result["areaWeightedNormalConcentration"] < .4
card = trimesh.creation.box(extents=[1, .001, 1])
assert geometry_checks(card.vertices, card.faces)["axisExtentRatio"] < .05
floor = trimesh.creation.box(extents=[10, 10, .001])
small_ball = trimesh.creation.icosphere(subdivisions=2, radius=.1)
small_ball.apply_translation([0, 0, .2])
combined = trimesh.util.concatenate([floor, small_ball])
assert geometry_checks(combined.vertices, combined.faces)["areaWeightedNormalConcentration"] > .95
print("Synthetic card/box/floor rejection and rounded-volume control pass")
