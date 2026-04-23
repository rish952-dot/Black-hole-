# AI Studio Physics/Neural Simulator

## Project Overview
A high-performance, AI-driven React web application featuring real-time physics and neural network simulations with WebGL shaders. Includes black hole visualizations (Schwarzschild/Kerr models), accretion disk rendering, and AI-powered simulation guidance via Google Gemini.

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
│   ├── App.tsx          # Main app component (WebGL shaders, simulation UI)
│   ├── main.tsx         # Entry point
│   ├── index.css        # Global styles + Tailwind imports
│   ├── neuralWorker.ts  # Web Worker for neural network calculations
│   └── physicsWorker.ts # Web Worker for physics/geodesic calculations
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## Environment Variables
- `GEMINI_API_KEY`: Required for AI features. Set in Replit Secrets.

## Development
- **Dev server**: `npm run dev` (port 5000)
- **Build**: `npm run build`

## Replit Configuration
- Dev server runs on `0.0.0.0:5000` with `allowedHosts: true` for proxy support
- Deployment configured as static site (`npm run build` → `dist/`)
