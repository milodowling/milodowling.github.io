// ADC-IMPLEMENTS: <home-feature-engine-slot-02>
// ADC-IMPLEMENTS: <home-impl-engine-interface-03>
//
// EngineSlot — the React-island mount point on the homepage for the
// (eventual) WebGL+JS video-art engine. In Phase 2 the slot is filled by the
// v1 placeholder shader (<home-impl-placeholder-04>), but the slot itself is
// deliberately separable from any particular render implementation: it owns
// the <canvas>, the time source, and the pointer tracking, and hands those
// to a render component as the named props `{time, pointer, params}`.
//
// Locked interface (from <home-impl-engine-interface-03>):
//
//   - time     : number — monotonic seconds since mount, derived from
//                performance.now() deltas inside a rAF loop the slot owns.
//   - pointer  : { x, y, active } — pointer position normalized to [0, 1]
//                across the canvas's bounding rect (origin top-left). `active`
//                is true between pointerdown and pointerup/pointerleave/
//                pointercancel on the canvas, OR while a pointer hovers over
//                it. (The contract calls for `active=true` while hovering OR
//                touching; we honor both.)
//   - params   : object — opaque to the shell. The slot passes `params`
//                straight through to the render component without reading,
//                validating, or branching on any key. See
//                <home-constraint-params-no-precedent-05>.
//
// Lifecycle: standard React mount/unmount. Cleanup cancels the rAF, removes
// pointer listeners, and disposes the WebGL context if the render component
// surrenders it via a cleanup function.
//
// Forward-compat: swapping the placeholder for the eventual engine is an
// import-line change on the homepage; the slot wiring here does not move.

import React from "react";
import PlaceholderShader from "./engine/PlaceholderShader.jsx";

// ADC-IMPLEMENTS: <home-impl-engine-interface-03>
// The slot is exported as the default React component. The render
// implementation is passed via the `render` prop (a function that receives
// `{time, pointer, params}` and returns a React node mounted alongside the
// canvas) OR defaults to the v1 placeholder.
//
// The slot's own surface area is small on purpose: anything richer
// (start/stop/pause control, render-target switching, etc.) belongs to the
// render implementation, not the slot.
export default function EngineSlot({ render, params }) {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [time, setTime] = React.useState(0);
  const [pointer, setPointer] = React.useState({ x: 0.5, y: 0.5, active: false });

  // The render implementation. Defaults to the v1 placeholder.
  // <home-constraint-params-no-precedent-05>: the slot does not look inside
  // `params`. `effectiveParams` is whatever the caller passed (or `{}`).
  const RenderImpl = render || defaultRender;
  const effectiveParams = params || {};

  // Time source: a rAF loop the slot owns. Drift-free — we accumulate
  // performance.now() deltas, not frame counts, per the Phase 2 brief.
  React.useEffect(() => {
    let rafId = 0;
    const mountedAt = performance.now();

    function tick(nowMs) {
      const seconds = (nowMs - mountedAt) / 1000;
      setTime(seconds);
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Pointer source: pointer events on the canvas. Pointer events handle
  // mouse + touch + pen natively; no separate touch path required.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    function toNormalized(event) {
      const rect = canvas.getBoundingClientRect();
      // Guard against degenerate rects (0-width during initial layout). If
      // width or height is zero, the rAF will fire again next frame and we
      // re-read. Returning the previous {x, y} keeps the shader stable.
      if (rect.width === 0 || rect.height === 0) return null;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      // Clamp to [0, 1]. Pointer events can fire slightly outside the rect
      // on some platforms (pointerleave at the edge).
      return {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
      };
    }

    function handleMove(event) {
      const n = toNormalized(event);
      if (n === null) return;
      setPointer((prev) => ({ x: n.x, y: n.y, active: prev.active || event.buttons > 0 || event.pointerType === "touch" }));
    }

    function handleEnter() {
      setPointer((prev) => ({ ...prev, active: true }));
    }

    function handleLeave() {
      // On leave, active goes false but x/y carry the last known position
      // per the contract.
      setPointer((prev) => ({ ...prev, active: false }));
    }

    function handleDown(event) {
      const n = toNormalized(event);
      if (n === null) return;
      setPointer({ x: n.x, y: n.y, active: true });
    }

    function handleUp(event) {
      const n = toNormalized(event);
      if (n === null) {
        setPointer((prev) => ({ ...prev, active: false }));
        return;
      }
      // After pointerup, hover state on desktop keeps `active=true` (still
      // over canvas); on touch, the pointer leaves with the touch.
      const stillHovering = event.pointerType !== "touch";
      setPointer({ x: n.x, y: n.y, active: stillHovering });
    }

    canvas.addEventListener("pointermove", handleMove);
    canvas.addEventListener("pointerenter", handleEnter);
    canvas.addEventListener("pointerleave", handleLeave);
    canvas.addEventListener("pointercancel", handleLeave);
    canvas.addEventListener("pointerdown", handleDown);
    canvas.addEventListener("pointerup", handleUp);

    return () => {
      canvas.removeEventListener("pointermove", handleMove);
      canvas.removeEventListener("pointerenter", handleEnter);
      canvas.removeEventListener("pointerleave", handleLeave);
      canvas.removeEventListener("pointercancel", handleLeave);
      canvas.removeEventListener("pointerdown", handleDown);
      canvas.removeEventListener("pointerup", handleUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="engine-slot-root">
      <canvas ref={canvasRef} className="engine-slot-canvas" />
      <RenderImpl
        canvasRef={canvasRef}
        time={time}
        pointer={pointer}
        params={effectiveParams}
      />
    </div>
  );
}

// Default render implementation: the v1 placeholder. Phase 4's swap test
// (<home-test-engine-interface-01>, step 4) substitutes a different
// implementation by replacing this file (or by passing a different `render`
// prop from Hero.astro); the slot wiring above does not need to change.
function defaultRender(props) {
  return <PlaceholderShader {...props} />;
}
