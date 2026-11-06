import { registerClientCommands } from "../console/clientCommands.js";
import { registerClientCVars } from "../console/clientCVars.js";
import { registerServerCommandStubs } from "../console/serverCommandStubs.js";
import type { GameContext } from "../core/GameScene.js";
import type { NetEmulatedClientTransport } from "../transport/NetEmulatedClientTransport.js";

/**
 * Register client cvars and commands on the game console and wire the cvars
 * to network emulation, camera zoom and the debug panel.
 */
export function registerClientConsole(
  gc: GameContext,
  netEmulatedTransport: NetEmulatedClientTransport,
): void {
  const engine = gc.console;
  const clientCVars = registerClientCVars(engine);
  registerClientCommands(engine, gc);
  registerServerCommandStubs(engine);

  const applyNetEmulationConfig = () => {
    netEmulatedTransport.setConfig({
      enabled: clientCVars.cl_netem.get(),
      txLossPct: clientCVars.cl_netem_tx_loss_pct.get(),
      rxLossPct: clientCVars.cl_netem_rx_loss_pct.get(),
      txLatencyMs: clientCVars.cl_netem_tx_latency_ms.get(),
      rxLatencyMs: clientCVars.cl_netem_rx_latency_ms.get(),
      txJitterMs: clientCVars.cl_netem_tx_jitter_ms.get(),
      rxJitterMs: clientCVars.cl_netem_rx_jitter_ms.get(),
    });
  };
  applyNetEmulationConfig();
  clientCVars.cl_netem.onChange(applyNetEmulationConfig);
  clientCVars.cl_netem_tx_loss_pct.onChange(applyNetEmulationConfig);
  clientCVars.cl_netem_rx_loss_pct.onChange(applyNetEmulationConfig);
  clientCVars.cl_netem_tx_latency_ms.onChange(applyNetEmulationConfig);
  clientCVars.cl_netem_rx_latency_ms.onChange(applyNetEmulationConfig);
  clientCVars.cl_netem_tx_jitter_ms.onChange(applyNetEmulationConfig);
  clientCVars.cl_netem_rx_jitter_ms.onChange(applyNetEmulationConfig);

  // Wire r_pixelscale cvar to camera zoom
  clientCVars.r_pixelscale.onChange((val) => {
    gc.camera.zoom = val;
  });

  // Wire r_show3d to debug panel checkbox (bidirectional)
  clientCVars.r_show3d.onChange((val) => {
    gc.debugPanel.show3d = val;
  });
  gc.debugPanel.onShow3dChange((checked) => {
    clientCVars.r_show3d.set(checked);
  });
}
