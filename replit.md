# AI Studio — Black Hole Physics Simulator

## Project Overview
A high-performance, research-grade React web application featuring real-time black hole physics simulation with WebGL shaders. Includes Kerr/Schwarzschild/Kerr-Newman metric ray-marching, accretion disk rendering, tidal disruption events, 4D spacetime visualization, and AI-guided parameter exploration via Google Gemini.

## Tech Stack
- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **AI**: Google Gemini SDK (`@google/genai`)
- **Animations**: Framer Motion / Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **Package Manager**: npm

## Project Structure
```
/
├── src/
│   ├── App.tsx           # Main app — WebGL shaders, UI, simulation state
│   ├── FourDPanel.tsx    # Isolated 4D spacetime floating panel (draggable)
│   ├── presets.ts        # 10 research-grade BH presets from published papers
│   ├── main.tsx          # Entry point
│   ├── index.css         # Global styles + Tailwind imports
│   ├── neuralWorker.ts   # Web Worker — neural network calculations
│   └── physicsWorker.ts  # Web Worker — geodesic physics calculations
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Key Features

### Physics Parameters (~40 total)
Core: mass, spin, charge, distance, frame drag, dark matter, 4D offset, coupling, aberration, ray depth

Advanced (from published papers):
- **Accretion disc**: Eddington ratio λ, α-viscosity (Shakura-Sunyaev), H/R aspect ratio, mass outflow rate, disk wind speed, TDE impact parameter β
- **Relativistic jet**: Bulk Lorentz factor Γ, jet opening angle, AGN mechanical feedback efficiency ε
- **Host galaxy**: Stellar velocity dispersion σ, M-σ power-law index α (Kormendy & Ho 2013), NFW concentration parameter, hot gas halo temperature
- **Binary merger**: Mass ratio q, chirp mass ℳ, orbital eccentricity, final merger spin a_f (Bowen-York)
- **S-star orbits**: S2 eccentricity (GRAVITY 2018 = 0.8843), orbital period (16.0455 yr)

### Research Presets (10 objects)
All parameters matched to published observations:
1. Sagittarius A* — EHT 2022, GRAVITY 2019
2. M87* — Event Horizon Telescope 2019
3. Cygnus X-1 — Miller-Jones et al. 2021, Science
4. GRS 1915+105 — McClintock et al. 2006, ApJ
5. AT2018dyb TDE — Leloudas et al. 2019, A&A
6. GW150914 Merger — LIGO/Virgo 2016, PRL
7. NGC 4889 BCG — McConnell et al. 2011, Nature
8. Sgr A* S2 Orbit — GRAVITY Collab. 2018, A&A
9. TON 618 Quasar — Shemmer et al. 2004, ApJ
10. Radio AGN Jet — Fabian 2012, ARA&A

### 4D Floating Window (FourDPanel)
Draggable, minimizable floating panel with three visualization modes:
- **4D Tesseract**: Rotating hypercube with Schwarzschild-warped 4th dimension
- **Spacetime Grid**: Kerr curvature tensor projected to XY plane
- **Penrose Diagram**: Conformal causal diagram with worldline and null geodesics

### 3D Mesh Debug (DAT tab)
Neural net graph view + 3D perspective-projected mesh debug of the simulation network.

## Environment Variables
- `GEMINI_API_KEY`: Required for AI features. Set in Replit Secrets.

## Development
- **Dev server**: `npm run dev` (port 5000)
- **Build**: `npm run build`

## Replit Configuration
- Dev server runs on `0.0.0.0:5000` with `allowedHosts: true` for proxy support
- Deployment configured as static site (`npm run build` → `dist/`)
