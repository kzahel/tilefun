import unittest

from projection_math import project, raw_frame_size


class RawFrameTests(unittest.TestCase):
    def test_tall_ambulance_is_not_clipped_before_camera_registration(self):
        points = [[x,y,z] for x in [-57,54] for y in [-21.5,21.5] for z in [0,52]]
        cameras = [{'azimuth': a, 'elevation': e} for a,e in [(90,46.85),(-90,46.85),(0,55),(180,55)]]
        width,height = raw_frame_size(points,cameras,(128,112))
        self.assertGreater(height,112)
        for camera in cameras:
            for point in points:
                u,v = project(point,{**camera,'horizontalScale':1,'verticalStretch':1,'origin':[0,0]})
                self.assertLessEqual(abs(u)+4,width/2)
                self.assertLessEqual(abs(v)+4,height/2)

    def test_existing_compact_frame_is_unchanged(self):
        points = [[x,y,z] for x in [-28,28] for y in [-12,12] for z in [0,21]]
        self.assertEqual(raw_frame_size(points,[{'azimuth':90,'elevation':42}],(64,64)),(64,64))


if __name__ == '__main__':
    unittest.main()
