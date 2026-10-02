import { type ReactNode, useEffect, useRef, useState } from "react";

interface View {
  zoom: number;
  x: number;
  y: number;
}

/** Inspect the original canvas through a CSS camera. Never resample its backing
 * pixels: review identities and annotation coordinates still refer to the render.
 */
export function PreviewViewport({
  width,
  height,
  children,
  controls,
  status,
}: {
  width: number;
  height: number;
  children: ReactNode;
  controls: ReactNode;
  status: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [preset, setPreset] = useState("fit");
  const [custom, setCustom] = useState<View | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    view: View;
  } | null>(null);
  const moved = useRef(false);
  const fit = Math.max(0.02, Math.min((size.width - 32) / width, (size.height - 32) / height));
  const zoom = preset === "native" ? 1 : preset === "large" ? 2 : fit;
  const view = custom ?? {
    zoom,
    x: (size.width - width * zoom) / 2,
    y: (size.height - height * zoom) / 2,
  };
  const current = useRef(view);
  current.current = view;
  const limits = useRef(fit);
  limits.current = fit;

  function update(next: View) {
    current.current = next;
    setCustom(next);
    setPreset("custom");
  }
  function zoomAt(factor: number, x = size.width / 2, y = size.height / 2) {
    const old = current.current;
    const next = Math.max(Math.min(fit, 1) / 4, Math.min(16, old.zoom * factor));
    update({
      zoom: next,
      x: x - ((x - old.x) * next) / old.zoom,
      y: y - ((y - old.y) * next) / old.zoom,
    });
  }
  function selectScale(value: string) {
    setPreset(value);
    setCustom(null);
  }
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new render size resets the inspection camera.
  useEffect(() => {
    setPreset("fit");
    setCustom(null);
  }, [width, height]);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    // React's delegated wheel listener is passive. Own this listener so the
    // gesture cannot scroll the page (or trigger browser zoom on trackpad pinch).
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const old = current.current;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientHeight : 1;
      const bounds = node.getBoundingClientRect();
      const x = event.clientX - bounds.left - node.clientLeft;
      const y = event.clientY - bounds.top - node.clientTop;
      // Two-finger scrolling often includes horizontal jitter. It must stay a
      // zoom gesture throughout, never switch to panning. Shifted/horizontal-only
      // wheel events zoom too; panning requires an actual pointer drag.
      const delta = Math.max(-200, Math.min(200, (event.deltaY || event.deltaX) * unit));
      const zoom = Math.max(
        Math.min(limits.current, 1) / 4,
        Math.min(16, old.zoom * Math.exp(-delta * 0.003)),
      );
      const next = {
        zoom,
        x: x - ((x - old.x) * zoom) / old.zoom,
        y: y - ((y - old.y) * zoom) / old.zoom,
      };
      current.current = next;
      setCustom(next);
      setPreset("custom");
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, []);
  return (
    <>
      <div
        ref={stage}
        className={`canvas-stage${dragging ? " dragging" : ""}`}
        role="application"
        aria-label="Preview viewport"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The interactive camera accepts keyboard zoom and arrow-key panning.
        tabIndex={0}
        data-preview-zoom={view.zoom}
        data-preview-x={view.x}
        data-preview-y={view.y}
        onPointerDown={(event) => {
          if (drag.current || (event.button !== 0 && event.button !== 1)) return;
          moved.current = false;
          drag.current = {
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            view: current.current,
          };
          // Capture on the original target so a stationary canvas tap still
          // reaches the room pin handler, while dragging works beyond the frame.
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
          stage.current?.focus({ preventScroll: true });
          if (event.button === 1) event.preventDefault();
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.pointerId !== event.pointerId) return;
          const dx = event.clientX - start.clientX,
            dy = event.clientY - start.clientY;
          if (!moved.current && Math.hypot(dx, dy) < 4) return;
          moved.current = true;
          setDragging(true);
          update({ ...start.view, x: start.view.x + dx, y: start.view.y + dy });
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) {
            drag.current = null;
            setDragging(false);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setDragging(false);
        }}
        onClickCapture={(event) => {
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
          }
        }}
        onKeyDown={(event) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [80, 0],
            ArrowRight: [-80, 0],
            ArrowUp: [0, 80],
            ArrowDown: [0, -80],
          };
          const step = moves[event.key];
          if (step)
            update({
              ...current.current,
              x: current.current.x + step[0],
              y: current.current.y + step[1],
            });
          else if (event.key === "+" || event.key === "=") zoomAt(1.5);
          else if (event.key === "-") zoomAt(1 / 1.5);
          else if (event.key === "Home") selectScale("fit");
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          className="canvas-stack"
          style={{
            width,
            height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
        >
          {children}
        </div>
      </div>
      {status}
      <div className="preview-controls">
        {controls}
        <label>
          Scale
          <select
            aria-label="Scale"
            value={preset}
            onChange={(event) => selectScale(event.target.value)}
          >
            <option value="fit">Fit preview</option>
            <option value="native">Native pixels</option>
            <option value="large">2× pixels</option>
            <option value="custom" disabled>
              Custom zoom
            </option>
          </select>
        </label>
        <button type="button" aria-label="Zoom preview out" onClick={() => zoomAt(1 / 1.5)}>
          −
        </button>
        <output aria-label="Preview zoom">{Math.round(view.zoom * 100)}%</output>
        <button type="button" aria-label="Zoom preview in" onClick={() => zoomAt(1.5)}>
          +
        </button>
        <button type="button" onClick={() => selectScale("fit")}>
          Fit
        </button>
        <span className="preview-help">
          Scroll to zoom · Click-drag or middle-button drag to pan
        </span>
      </div>
    </>
  );
}
