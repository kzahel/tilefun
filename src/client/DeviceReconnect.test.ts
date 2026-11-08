/**
 * A remote device's guests across a dropped connection (226 slice 5-ii-c), end to end:
 * the real server (`memoryServer`, every message through the binary codec) keeps each
 * seat dormant when the device drops, and the client's `DeviceSeats` seats its guests
 * again on the realm entry that follows, as the router does (`disconnected`, `enterRealm`).
 */
import { afterEach, expect, it } from "vitest";
import { NEUTRAL_MOVEMENT, neutralSample, type SeatInput } from "../input/SeatInput.js";
import {
  play,
  remote,
  sessionOf,
  start,
  step,
  stopDevices,
  where,
} from "../server/test/DeviceHarness.js";
import { DeviceSeats, type Requester } from "../session/DeviceSeats.js";

afterEach(stopDevices);

/** A guest's devices; the test sends its movement in the device packets itself. */
const devices = (): SeatInput => ({
  steering: false,
  held: () => false,
  sample: () => neutralSample(),
  clear: () => {},
  dispose: () => {},
  on: () => () => {},
  hint: () => "",
});

it("seats a remote device's guest again when it reconnects, so its input reaches authority", async () => {
  const device = await start();
  const { server, transport } = device;
  await remote(device, "dev-b");
  const seats = new DeviceSeats();
  let requestId = 50;
  /** A request from the device and its reply, after the server settles. */
  const request = (async (msg) => {
    transport.send("dev-b", msg);
    await server.settle();
    const reply = transport.received
      .get("dev-b")
      ?.find((m) => "requestId" in m && m.requestId === msg.requestId);
    if (!reply || reply.type === "request-error") throw Error(`no reply to ${msg.type}`);
    return reply;
  }) as Requester;
  await seats.join(request, ++requestId, 1, devices(), { displayName: "Player 2" });
  const guest = sessionOf(server, "dev-b#1");
  if (!guest) throw Error("no guest");
  const walking = () => [
    { seat: 0, movement: NEUTRAL_MOVEMENT },
    { seat: 1, movement: step(1, 0) },
  ];

  // The connection drops and comes back: seat 0 resumes, and the guest stays dormant, so
  // its walking reaches nobody.
  transport.disconnect("dev-b");
  seats.connectionLost();
  transport.connect("dev-b");
  await server.settle();
  expect(transport.messages("dev-b", "world-loaded")).toHaveLength(1);
  expect(server.isDormant("dev-b#1")).toBe(true);
  const stood = where(guest);
  play(device, "dev-b", 1, 10, walking);
  expect(where(guest)).toEqual(stood);

  // The realm entry seats it again: the same player, awake, on the device's sequence.
  await seats.reseat(request, () => ++requestId);
  expect(transport.messages("dev-b", "seat-joined").at(-1)).toMatchObject({ seat: 1 });
  expect(sessionOf(server, "dev-b#1")).toBe(guest);
  expect(server.isDormant("dev-b#1")).toBe(false);
  expect(seats.get(1)).toBeDefined();
  play(device, "dev-b", 11, 40, walking);
  expect(where(guest).wx).toBeGreaterThan(stood.wx);
  expect(guest.lastProcessedInputSeq).toBe(40);
});
