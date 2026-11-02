import { Link } from "react-router";

/** Old bookmarks remain understandable while unsupported simulation owners retire. */
export default function DeferredVehiclePage() {
  return (
    <section>
      <h1>Vehicle equipment and services</h1>
      <p>
        Towing, tipping beds, transporter apparatus, boats and train services are deferred during
        the physics reset. Vehicle models and static layout studies remain available.
      </p>
      <p>
        <Link to="/tool/traffic">Open basic driving</Link> ·{" "}
        <Link to="/tool/physics">Open co-op physics</Link> ·{" "}
        <Link to="/tool/world-geometry">Open ramps and bridges</Link>
      </p>
    </section>
  );
}
