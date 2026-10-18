import { describe, expect, it } from "vitest";
import { PARKING_CASES, type ParkingRect, parkingStudy } from "./ParkingLotStudy.js";

const overlaps = (a: ParkingRect, b: ParkingRect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("parking layout studies", () => {
  for (const c of PARKING_CASES)
    it(`${c.name} keeps spaces separate from other spaces, walks and drive aisles`, () => {
      const plan = parkingStudy(c.id);
      expect(plan.bays.length).toBeGreaterThanOrEqual(16);
      expect(new Set(plan.bays.map((b) => b.id)).size).toBe(plan.bays.length);
      for (const [i, b] of plan.bays.entries()) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(plan.width);
        expect(b.y + b.height).toBeLessThanOrEqual(plan.height);
        for (const r of [...plan.bays.slice(i + 1), ...plan.drives, ...plan.walks])
          expect(overlaps(b, r), `${b.id} overlaps ${JSON.stringify(r)}`).toBe(false);
      }
      expect(plan.bays.some((b) => b.occupied)).toBe(true);
      expect(plan.bays.some((b) => !b.occupied)).toBe(true);
      for (const p of plan.pieces) {
        expect(p.rect[0]).toBeGreaterThanOrEqual(0);
        expect(p.rect[1]).toBeGreaterThanOrEqual(0);
        expect(p.rect[0] + p.rect[2]).toBeLessThanOrEqual(2816);
        expect(p.rect[1] + p.rect[3]).toBeLessThanOrEqual(8224);
      }
    });
});
