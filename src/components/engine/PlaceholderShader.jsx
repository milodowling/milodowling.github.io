// ADC-IMPLEMENTS: <home-impl-placeholder-04>
//
// v1 engine-slot placeholder. A deliberately ugly plain-WebGL2 test pattern
// that proves the slot's `{time, pointer, params}` interface is wired all
// the way to the GPU. It exists to validate plumbing, not to suggest design.
//
// Per <home-impl-placeholder-04>:
//   - Must render to WebGL using only `time` and `pointer` from props.
//   - Must visibly animate (time-driven) AND react to pointer position.
//   - Must NOT visually suggest the eventual analog-feedback engine. The
//     pattern below is a vertical-bar + crosshatch + crosshair composition —
//     deliberately diagrammatic, not painterly.
//   - Must degrade gracefully on mobile: DPR clamped to 1 on narrow viewports,
//     and a CSS fallback color shows if WebGL2 context creation fails.
//
// Per <home-constraint-params-no-precedent-05>:
//   - This file declares two demonstration `params` keys (`speed` and
//     `tintShift`) PURELY as a wiring proof that the slot can pass params
//     through. THE ENGINE PASS IS NOT BOUND BY THESE KEYS — see the comment
//     at `extractParams()` below for the full disclaimer.
//
// Per the Phase 2 brief:
//   - Plain WebGL2 only. No three.js, no regl, no shader framework. Vertex
//     shader is the standard fullscreen-triangle trick; fragment shader is
//     a hand-written test pattern.

import React from "react";

// ADC-IMPLEMENTS: <home-constraint-params-no-precedent-05>
// PLACEHOLDER-ONLY params extraction. The eventual engine pass MAY redefine
// these keys, rename them, change their types, or remove them without any
// shell-side coordination. The shell does not read, validate, or branch on
// any `params` key — this function is internal to the placeholder render
// implementation and exists solely to demonstrate that the slot's pass-
// through wiring works.
//
// If you are reading this from the engine pass: nuke this function. Define
// whatever `params` shape your engine needs. The slot doesn't care.
function extractParams(params) {
  // Default `speed` to 0.25 (slow hue cycle) and `tintShift` to 0 (no bias)
  // if the caller didn't supply them. These defaults exist ONLY so the
  // demonstration shader doesn't crash if `params` is `{}`; they are not
  // a precedent.
  const speed = typeof params.speed === "number" ? params.speed : 0.25;
  const tintShift = typeof params.tintShift === "number" ? params.tintShift : 0;
  return { speed, tintShift };
}

const VERTEX_SHADER_SRC = `#version 300 es
// Fullscreen triangle — covers the viewport with one draw call, no vertex
// buffer required. The fragment shader receives normalized device coords
// implicitly via gl_FragCoord.
out vec2 v_uv;
void main() {
  // Two-triangle fan generates a triangle covering the full viewport.
  // gl_VertexID 0,1,2 → (-1,-1), (3,-1), (-1,3) — the standard trick.
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  v_uv = (pos + 1.0) * 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision mediump float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;       // seconds since mount
uniform vec2 u_pointer;     // [0,1], origin top-left in canvas pixel space
uniform float u_pointerActive; // 1.0 if active, 0.0 otherwise
uniform vec2 u_resolution;
uniform float u_speed;      // demo param — see PlaceholderShader.jsx
uniform float u_tintShift;  // demo param — see PlaceholderShader.jsx

// Cheap hash for moving noise.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  // Canvas origin is top-left; v_uv.y goes 0=bottom→1=top. Flip y so the
  // shader's coordinate frame matches the contract's pointer frame
  // (origin top-left, y=0 at top).
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);

  // === TIME-DRIVEN COMPONENT ===
  // Vertical stripes that drift horizontally over time. Deliberately blocky
  // and diagrammatic — looks like a test card, not a composition.
  float stripe = step(0.5, fract(uv.x * 8.0 - u_time * u_speed));

  // Hue cycle on top of the stripes. Slow cycle so it's clearly time-driven.
  float hue = fract(u_time * u_speed * 0.5 + u_tintShift);
  vec3 baseColor = 0.3 + 0.4 * vec3(
    sin(hue * 6.2831),
    sin(hue * 6.2831 + 2.094),
    sin(hue * 6.2831 + 4.188)
  );

  // Crosshatch noise field — also time-driven — overlaid on the stripes
  // to make per-frame change obviously visible (the pixel-change assertion
  // in <home-test-engine-interface-01> needs unambiguous frame-to-frame
  // delta).
  float noise = hash(floor(uv * 80.0) + floor(u_time * 4.0));
  vec3 color = mix(baseColor * stripe, vec3(noise), 0.15);

  // === POINTER-DRIVEN COMPONENT ===
  // A crosshair highlight that tracks the pointer. When active, the
  // crosshair is bright; when inactive (pointer off canvas), it fades to a
  // faint last-known position. Both cases visibly consume \`pointer\` — the
  // test only asserts pixel change with pointer active, so we don't need
  // perfect inactive behavior, but we keep a ghost so the wiring is
  // observable even without moving the mouse.
  vec2 toPointer = uv - u_pointer;
  float dist = length(toPointer);
  float crosshairCross =
    smoothstep(0.004, 0.0, abs(toPointer.x)) +
    smoothstep(0.004, 0.0, abs(toPointer.y));
  float crosshairRing = smoothstep(0.06, 0.05, dist) - smoothstep(0.05, 0.04, dist);
  float crosshair = clamp(crosshairCross + crosshairRing, 0.0, 1.0);
  crosshair *= mix(0.25, 1.0, u_pointerActive);

  // Pointer also warps the stripe phase locally — a subtle radial pull.
  float pullAmt = (1.0 - smoothstep(0.0, 0.25, dist)) * 0.5 * u_pointerActive;
  float warpedStripe = step(0.5, fract((uv.x + pullAmt) * 8.0 - u_time * u_speed));
  color = mix(color, baseColor * warpedStripe, pullAmt);

  // Composite crosshair on top in bright magenta (debug-pattern aesthetic).
  color = mix(color, vec3(1.0, 0.3, 0.9), crosshair);

  // Faint corner markers — pure test-card framing. Confirms canvas extents.
  vec2 cornerDist = min(uv, 1.0 - uv);
  float corner = step(min(cornerDist.x, cornerDist.y), 0.005);
  color = mix(color, vec3(1.0), corner * 0.4);

  fragColor = vec4(color, 1.0);
}`;

function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`PlaceholderShader: shader compile failed: ${log}`);
  }
  return shader;
}

function linkProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`PlaceholderShader: program link failed: ${log}`);
  }
  return program;
}

export default function PlaceholderShader({ canvasRef, time, pointer, params }) {
  // <home-constraint-params-no-precedent-05>: placeholder-only demonstration
  // keys; not a precedent for the engine pass.
  const { speed, tintShift } = extractParams(params);

  // Refs for GL state. We initialize GL exactly once on mount and tear down
  // on unmount; we re-render per frame inside a useEffect that listens to
  // `time` so the canvas redraws every animation tick.
  const glRef = React.useRef(null);
  const programRef = React.useRef(null);
  const uniformsRef = React.useRef(null);
  const vaoRef = React.useRef(null);
  const initErrorRef = React.useRef(null);

  // One-time GL init. Runs after the canvas is mounted (canvasRef.current is
  // populated by EngineSlot's render). We guard with initErrorRef so failures
  // don't loop or spam the console.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      // Mobile-degradation path per <home-test-mobile-degradation-02> step 3:
      // context creation failed. We mark the canvas with a fallback class so
      // CSS can show a neutral background, and bail. The page still renders.
      canvas.classList.add("engine-slot-canvas--no-webgl");
      initErrorRef.current = new Error("WebGL2 context unavailable");
      return undefined;
    }

    const vs = compileShader(gl, VERTEX_SHADER_SRC, gl.VERTEX_SHADER);
    const fs = compileShader(gl, FRAGMENT_SHADER_SRC, gl.FRAGMENT_SHADER);
    const program = linkProgram(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Empty VAO — the vertex shader uses gl_VertexID to generate positions,
    // so we don't need any vertex attributes. We still need a bound VAO for
    // WebGL2 conformance.
    const vao = gl.createVertexArray();

    const uniforms = {
      u_time: gl.getUniformLocation(program, "u_time"),
      u_pointer: gl.getUniformLocation(program, "u_pointer"),
      u_pointerActive: gl.getUniformLocation(program, "u_pointerActive"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_speed: gl.getUniformLocation(program, "u_speed"),
      u_tintShift: gl.getUniformLocation(program, "u_tintShift"),
    };

    glRef.current = gl;
    programRef.current = program;
    uniformsRef.current = uniforms;
    vaoRef.current = vao;

    // ResizeObserver: keep the canvas drawing buffer in sync with the
    // displayed size. We clamp DPR on narrow viewports to keep mobile
    // GPUs out of trouble per <home-impl-placeholder-04> mobile-degrades-
    // gracefully clause.
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const isMobile = rect.width < 600;
      const dpr = isMobile
        ? Math.min(window.devicePixelRatio || 1, 1)
        : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      // Dispose GL resources. After context loss, these calls are no-ops or
      // harmless; we still call them for cleanliness.
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      glRef.current = null;
      programRef.current = null;
      uniformsRef.current = null;
      vaoRef.current = null;
    };
  }, [canvasRef]);

  // Per-frame draw. Runs whenever `time` updates (i.e., every rAF tick from
  // the slot). We also depend on pointer/speed/tintShift so they're
  // captured fresh each frame.
  React.useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const vao = vaoRef.current;
    if (!gl || !program || !uniforms || !vao) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1f(uniforms.u_time, time);
    gl.uniform2f(uniforms.u_pointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.u_pointerActive, pointer.active ? 1.0 : 0.0);
    gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.u_speed, speed);
    gl.uniform1f(uniforms.u_tintShift, tintShift);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }, [time, pointer.x, pointer.y, pointer.active, speed, tintShift, canvasRef]);

  // The shader renders into the canvas owned by EngineSlot; this component
  // has no DOM of its own.
  return null;
}
