import { Link } from "react-router";

/** Old bookmarks remain understandable while unsupported simulation owners retire. */
export default function DeferredVehiclePage() {
  return (
    <section>
      <h1>Vehicle equipment and services</h1>
      <p>
        This old lab address has moved. The dump bed, tow truck and car transporter are playable in
        the vehicle dynamics course (bed, tow and transport starts); speedway racers and shopping
        visits are the racetrack and shopping fixtures of the world geometry lab.
      </p>
      <p>
        <Link to="/tool/traffic">Open basic driving</Link> ·{" "}
        <Link to="/tool/physics">Open co-op physics</Link> ·{" "}
        <Link to="/tool/world-geometry">Open ramps and bridges</Link>
      </p>
    </section>
  );
}
