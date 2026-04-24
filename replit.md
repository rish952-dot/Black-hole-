# AI Studio — Black Hole Physics Simulator

## Project Overview
A high-performance, research-grade React web application featuring real-time black hole physics simulation with WebGL shaders. Includes Kerr/Schwarzschild/Kerr-Newman metric ray-marching, accretion disk rendering, tidal disruption events, 4D spacetime visualization, and a full navigator suite with LIGO event waveforms, galactic N-body simulation, neural parameter tapestry, and more.

## Tech Stack
- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **3D**: Three.js + @react-three/fiber + @react-three/drei (for navigator views)
- **Charts**: Recharts
- **Animations**: Framer Motion / Motion
- **Icons**: Lucide React
- **Package Manager**: npm

## Project Structure
```
/
├── src/
│   ├── App.tsx               # Main app — WebGL shaders, UI, simulation state (~2180 lines)
│   ├── FourDPanel.tsx        # Isolated 4D spacetime floating panel (draggable)
│   ├── NavigatorPanel.tsx    # Full-screen navigator panel with 10 research views
│   ├── presets.ts            # 10 research-grade BH presets from published papers
│   ├── main.tsx              # Entry point
│   ├── index.css             # Global styles + Tailwind imports
│   ├── neuralWorker.ts       # Web Worker — neural network calculations
│   ├── physicsWorker.ts      # Web Worker — geodesic physics calculations
│   └── navigator/            # Black Hole Navigator components (from navigator ZIP)
│       ├── utils.ts          # cn() helper + COLORS constants
│       ├── use-mobile.ts     # Responsive hook
│       ├── ligo-events.ts    # GWTC-3 catalog + strain waveform generator
│       ├── featured-stars.ts # ~27 curated stars + compact objects (NASA/ESA/EHT)
│       ├── navigator-shader.ts # GPU fragment shader: Schwarzschild+Kerr+NFW
│       ├── BlackHoleQuad.tsx # Three.js fullscreen shader quad component
│       ├── BlackHoleViewport.tsx # Orbit-controlled BH viewport wrapper
│       ├── SpacetimeGrid.tsx # 3D Flamm paraboloid + autonomous orbiting stars
│       ├── NeuralTapestry.tsx # 30k-node instanced parameter mesh
│       ├── MathGraphs.tsx    # V_eff, T(r), redshift, NFW DM charts (Recharts)
│       ├── LigoWaveform.tsx  # LIGO event selector + strain h(t) chart
│       ├── AccretionDiskStudy.tsx # Thin-disk 3D + Shakura-Sunyaev profiles
│       ├── GalacticPlane.tsx # N-body galaxy formation with timeline scrubber
│       ├── StarDetails.tsx   # Star catalog browser with Gaia/EHT/Chandra data
│       ├── DataMatrix.tsx    # Live metric tensor + parameter display
│       ├── IOMeshOverlay.tsx # I/O parameter mesh topology visualization
│       └── physics-constants.json # Physical constants reference
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Key Features

### Main Simulator (App.tsx)
- Real-time WebGL2 Kerr/Schwarzschild/Kerr-Newman ray-marching
- Accretion disk with Shakura-Sunyaev temperature profile
- Tidal disruption events (TDE mode)
- ~25 advanced physics parameters (Eddington ratio, jet Lorentz factor, M-σ, etc.)
- 10 research-grade presets (Sgr A*, M87*, GW150914 remnant, etc.)
- 4D spacetime panel (tesseract, Penrose diagram, spacetime ripple modes)

### Navigator Panel (NavigatorPanel.tsx + navigator/)
Accessible via "Navigator" button in header — 10 views:
1. **Spacetime Grid** — 3D Flamm paraboloid + 400 autonomous Keplerian orbiting stars
2. **BH Viewport** — Multi-mode navigator shader (full, geodesic heat, grid overlay, DM-only)
3. **LIGO Events** — GWTC-3 catalog with post-Newtonian strain h(t) reconstruction
4. **Accretion Disk** — 3D thin-disk Three.js + T(r)/F(r)/v(r)/λ(r) Recharts profiles
5. **Galactic Plane** — N-body galaxy simulation (spiral/elliptical/irregular/colliding) + timeline
6. **Neural Tapestry** — 30k-node instanced mesh with broken-connection detection
7. **Math Graphs** — Live V_eff(r), T(r), z(r), M_DM(r) physics graphs
8. **Star Catalog** — 27 stars/compact objects (Sgr A*, M87*, Crab Pulsar, TRAPPIST-1, etc.)
9. **Data Matrix** — Live Schwarzschild metric tensor g_μν + derived scalars
10. **I/O Mesh** — Parameter topology visualization (25 inputs → hidden → 4 outputs)

## Dev Server
- Runs on port 5000 via `npm run dev`
- Workflow: "Start application"
