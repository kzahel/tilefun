import {
  RailAlignment,
  type RailPath,
  type RailSegment,
  segmentLength,
} from "../railway/RailPath.js";
import { required } from "../shared/required.js";

const line = (x: number, y: number, endX: number, endY: number): RailSegment => ({
  kind: "line",
  x,
  y,
  endX,
  endY,
});
const arc = (x: number, y: number, angle: number, sweep: number): RailSegment => ({
  kind: "arc",
  x,
  y,
  angle,
  sweep,
  radius: 256,
});
/** A loop with four stops, or a two-terminus corridor with opposite bends and a through stop. */
export function curvedTrackPath(loop = true, reverse = false): RailPath {
  const segments: RailSegment[] = loop
    ? [
        line(-384, -512, 384, -512),
        arc(384, -256, -Math.PI / 2, Math.PI / 2),
        line(640, -256, 640, 256),
        arc(384, 256, 0, Math.PI / 2),
        line(384, 512, -384, 512),
        arc(-384, 256, Math.PI / 2, Math.PI / 2),
        line(-640, 256, -640, -256),
        arc(-384, -256, Math.PI, Math.PI / 2),
      ]
    : [
        line(-1280, 384, -512, 384),
        arc(-512, 128, Math.PI / 2, -Math.PI / 2),
        line(-256, 128, -256, -128),
        arc(0, -128, Math.PI, Math.PI / 2),
        line(0, -384, 1280, -384),
      ];
  const lengths = segments.map(segmentLength);
  const total = lengths.reduce((a, b) => a + b, 0);
  const path: RailPath = {
    segments,
    closed: loop,
    reverse,
    stops: loop
      ? [
          { distance: 384, name: "North" },
          { distance: required(lengths[0]) + required(lengths[1]) + 256, name: "East" },
          { distance: total / 2 + 384, name: "South" },
          { distance: total / 2 + required(lengths[0]) + required(lengths[1]) + 256, name: "West" },
        ]
      : [
          { distance: 256, name: "Town A" },
          { distance: total - 896, name: "Valley" },
          { distance: total - 256, name: "Town B" },
        ],
  };
  new RailAlignment(path);
  return path;
}
