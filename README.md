# Semaphore ’26 — Underwater Fest City

Semaphore ’26 is a cinematic Vite + Three.js college-fest experience for **NMAM Institute of Technology, Nitte–Karkala**. Visitors scroll through a fixed underwater city while a realistic animated dolphin follows a reversible spline route between interactive fest-event locations.

The project preserves the original Cyber Ocean WebGL foundation: the dolphin model, underwater particles, custom shaders, post-processing, audio, resource loading, and performance-oriented render architecture.

<img src="./PREVIEW.png" width="100%" alt="Semaphore underwater fest experience preview" />

## Experience

- Opening composition with the dolphin in open water beside the Semaphore introduction.
- A static, world-space underwater city: towers, labs, event halls, gallery/college buildings, roads, bridges, streetlights, emissive windows, and a distant skyline.
- One deterministic `CatmullRomCurve3` route for the dolphin. Scrolling forward and backward follows the identical route in either direction.
- Cinematic camera choreography: a wide opening view, descent into the city corridor, and smooth camera follow while the dolphin approaches event façades.
- Interactive event points physically anchored to fixed 3D event-building positions and projected into HTML screen space.
- Dynamic glass event-information panel with event image, category, schedule, venue, team size, prize, and registration action.
- Responsive desktop/mobile UI, sound toggle, reduced-motion support, and loading experience.

## Controls

- **Scroll** — travel along the dolphin’s underwater route.
- **Event marker (`i`)** — focus the dolphin near the associated fixed building and open its event details.
- **Escape / close button** — close the event panel and resume the scroll-driven journey.
- **Sound control** — toggle underwater ambience.

## Architecture

The WebGL city is deliberately fixed in world space. During the journey only the dolphin, camera, ambient systems, and projected HTML markers change. Buildings, road geometry, infrastructure, window instances, and event anchors are created once and remain static.

```text
Browser scroll
  → normalized scroll progress
  → DolphinPath (Catmull-Rom spline)
  → dolphin position + orientation
  → camera follow
  → EventManager projects fixed building anchors to HTML markers
```

Key modules:

- `src/Game/World/Components/Dolphin/Dolphin.class.js` — animated dolphin, orientation, and route progress.
- `src/Game/World/Components/Dolphin/DolphinPath.class.js` — authored 3D travel and event-approach waypoints.
- `src/Game/World/Components/City/CityManager.class.js` — one-time fixed city construction, event-building binding, instanced windows, roads, bridges, and architectural details.
- `src/Game/World/Components/Events/EventData.js` — centralized fest-event data.
- `src/Game/World/Components/Events/EventManager.class.js` — event selection and marker lifecycle.
- `src/Game/World/Components/Events/EventPoint.class.js` — projected HTML marker attached to a world-space building anchor.
- `src/Game/World/Components/Events/EventInfoPanel.class.js` — dynamic event-detail panel.
- `src/Game/World/Components/Events/WorldToScreen.js` — Three.js world-to-screen projection utility.
- `src/Game/Systems/ScrollController.class.js` — normalized, reversible scroll state and settled/dirty gating.

## Tech stack

| Area | Technology |
| --- | --- |
| Build tool | Vite 6 |
| 3D rendering | Three.js |
| Language | Modern JavaScript (ES modules) |
| WebGL effects | Custom GLSL vertex/fragment shaders, additive particles, fog, and post-processing |
| 3D assets | GLTF/GLB dolphin model with Three.js animation mixer and DRACO support |
| Event interface | Semantic HTML, CSS, and projected world-to-screen DOM markers |
| Animation | One `requestAnimationFrame` loop, Catmull-Rom spline motion, quaternion interpolation, and scroll-state easing |
| Performance | Instanced window meshes, capped pixel ratio, mobile particle reductions, visibility handling, and settled-state update gating |
| Audio | Native browser `Audio` API |

The app intentionally remains framework-free: it does not use React, Next.js, or a separate UI runtime. The HTML event layer sits over the persistent WebGL canvas so event content stays responsive and accessible.

## Debug mode

Run the site with `?mode=debug` to inspect the authored route and city clearance:

- Cyan spline line.
- Cyan travel nodes and amber approach nodes.
- City bounding boxes.
- Existing Three.js debug controls.

Example: `http://localhost:5173/?mode=debug`

## Prerequisites

- Node.js 18+ recommended
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

## Production build

```bash
npm run build
```

## Preview production build

```bash
npm run preview
```

## Assets and licenses

The dolphin model and other third-party assets retain their respective licenses. See `public/assets/models/` and included license files for details.
