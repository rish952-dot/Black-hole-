import { useState, Suspense } from 'react';
import { SpacetimeGrid } from './navigator/SpacetimeGrid';
import { NeuralTapestry } from './navigator/NeuralTapestry';
import { MathGraphs } from './navigator/MathGraphs';
import { LigoWaveform } from './navigator/LigoWaveform';
import { StarDetails } from './navigator/StarDetails';
import { AccretionDiskStudy } from './navigator/AccretionDiskStudy';
import { GalacticPlane } from './navigator/GalacticPlane';
import { DataMatrix } from './navigator/DataMatrix';
import { IOMeshOverlay } from './navigator/IOMeshOverlay';
import { BlackHoleViewport } from './navigator/BlackHoleViewport';
import type { BlackHoleParams } from './navigator/BlackHoleQuad';

interface Props {
  open: boolean;
  onClose: () => void;
  simParams: {
    mass: number;
    spin: number;
    diskInner: number;
    diskOuter: number;
    diskTilt: number;
    doppler: number;
    lensing: number;
    exposure: number;
    steps: number;
    darkMatter: number;
    haloScale: number;
    stringDim: number;
    frameDrag: number;
    redshift: number;
    vectorScale: number;
    thermal: number;
    darkOnly: number;
    rayBounces: number;
    eddingtonRatio?: number;
    diskViscosity?: number;
    jetLorentzFactor?: number;
  };
}

const NAV_TABS = [
  { id: 'spacetime', label: 'Spacetime Grid', icon: '⧖' },
  { id: 'viewport', label: 'BH Viewport', icon: '◉' },
  { id: 'ligo', label: 'LIGO Events', icon: '〰' },
  { id: 'accretion', label: 'Accretion Disk', icon: '◎' },
  { id: 'galactic', label: 'Galactic Plane', icon: '✦' },
  { id: 'neural', label: 'Neural Tapestry', icon: '⬡' },
  { id: 'math', label: 'Math Graphs', icon: '𝑓' },
  { id: 'stars', label: 'Star Catalog', icon: '★' },
  { id: 'matrix', label: 'Data Matrix', icon: '▦' },
  { id: 'io', label: 'I/O Mesh', icon: '⬡' },
] as const;

type TabId = typeof NAV_TABS[number]['id'];

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500/30 border-t-orange-500 mx-auto" />
        <div className="text-[11px] font-mono text-white/30">Loading 3D engine…</div>
      </div>
    </div>
  );
}

export function NavigatorPanel({ open, onClose, simParams }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('spacetime');

  if (!open) return null;

  const bhParams: BlackHoleParams = {
    mass: simParams.mass,
    spin: simParams.spin,
    diskInner: simParams.diskInner,
    diskOuter: simParams.diskOuter,
    diskTilt: simParams.diskTilt,
    exposure: simParams.exposure,
    steps: simParams.steps,
    doppler: simParams.doppler,
    lensing: simParams.lensing,
    mode: 0,
    cameraDistance: 22,
    cameraOrbit: 0.6,
    cameraElevation: 0.25,
    autoRotate: true,
    darkMatter: simParams.darkMatter,
    haloScale: simParams.haloScale,
    stringDim: simParams.stringDim,
    frameDrag: simParams.frameDrag,
    redshift: simParams.redshift,
    vectorScale: simParams.vectorScale,
    thermal: simParams.thermal,
    darkOnly: simParams.darkOnly,
    rayBounces: simParams.rayBounces,
    timeLapse: 1,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#020208]/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 text-sm">◉</div>
          <div>
            <div className="text-sm font-semibold text-white/90">Black Hole Navigator</div>
            <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">research-grade visualization suite</div>
          </div>
        </div>
        <button onClick={onClose}
          className="h-8 w-8 rounded-lg border border-white/10 bg-white/4 text-white/40 hover:text-white/80 hover:bg-white/8 transition-all text-sm flex items-center justify-center">
          ✕
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        <div className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-white/8 p-2 overflow-y-auto">
          {NAV_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${activeTab === tab.id ? 'border-orange-500/40 bg-orange-500/10 text-orange-300' : 'border-transparent text-white/40 hover:border-white/10 hover:bg-white/5 hover:text-white/70'}`}>
              <span className="text-xs">{tab.icon}</span>
              <span className="font-mono text-[10px] leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'spacetime' && (
            <div className="h-full flex flex-col gap-3 min-h-[500px]">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Schwarzschild Flamm paraboloid embedding · {simParams.spin > 0 ? `Kerr spin a/M=${simParams.spin.toFixed(2)}` : 'Schwarzschild'}</div>
              <div className="flex-1">
                <Suspense fallback={<LoadingFallback />}>
                  <SpacetimeGrid mass={simParams.mass} spin={simParams.spin} starCount={400} vectorScale={simParams.vectorScale}
                    darkOnly={simParams.darkOnly > 0.5} gwAmplitude={0} className="h-[500px]" />
                </Suspense>
              </div>
            </div>
          )}

          {activeTab === 'viewport' && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Navigator renderer · Schwarzschild + Kerr + NFW dark matter halo</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Suspense fallback={<LoadingFallback />}>
                  <BlackHoleViewport params={bhParams} label="Current Config" sublabel={`M=${simParams.mass.toFixed(1)} a/M=${simParams.spin.toFixed(2)}`} badge="live" active className="h-[340px]" />
                  <BlackHoleViewport params={{ ...bhParams, mode: 1 }} label="Geodesic Heat Map" sublabel="lensing deflection angle" className="h-[340px]" />
                </Suspense>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Suspense fallback={<LoadingFallback />}>
                  <BlackHoleViewport params={{ ...bhParams, mode: 3 }} label="Coordinate Grid Overlay" sublabel="equatorial spacetime grid" className="h-[280px]" />
                  <BlackHoleViewport params={{ ...bhParams, darkOnly: 1, darkMatter: Math.max(simParams.darkMatter, 0.4) }} label="Dark Matter Only" sublabel="NFW halo visible" className="h-[280px]" />
                </Suspense>
              </div>
            </div>
          )}

          {activeTab === 'ligo' && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">LIGO/Virgo gravitational wave catalog · post-Newtonian strain reconstruction</div>
              <LigoWaveform />
            </div>
          )}

          {activeTab === 'accretion' && (
            <Suspense fallback={<LoadingFallback />}>
              <AccretionDiskStudy mass={simParams.mass} spin={simParams.spin} diskInner={simParams.diskInner} diskOuter={simParams.diskOuter} />
            </Suspense>
          )}

          {activeTab === 'galactic' && (
            <Suspense fallback={<LoadingFallback />}>
              <div className="h-[calc(100vh-160px)] min-h-[500px]">
                <GalacticPlane className="h-full" />
              </div>
            </Suspense>
          )}

          {activeTab === 'neural' && (
            <Suspense fallback={<LoadingFallback />}>
              <div className="h-[calc(100vh-160px)] min-h-[500px]">
                <NeuralTapestry errorRate={0.003} />
              </div>
            </Suspense>
          )}

          {activeTab === 'math' && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Live physics model graphs · synced to current simulator parameters</div>
              <MathGraphs mass={simParams.mass} spin={simParams.spin} diskInner={simParams.diskInner}
                diskOuter={simParams.diskOuter} darkMatter={simParams.darkMatter} haloScale={simParams.haloScale} />
            </div>
          )}

          {activeTab === 'stars' && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Curated star & compact object catalog · NASA / ESA / ESO / EHT sources</div>
              <StarDetails />
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Live parameter data matrix · Schwarzschild metric tensor at r=10r_s</div>
              <DataMatrix params={{
                mass: simParams.mass, spin: simParams.spin, frameDrag: simParams.frameDrag,
                diskInner: simParams.diskInner, diskOuter: simParams.diskOuter,
                darkMatter: simParams.darkMatter, haloScale: simParams.haloScale,
                stringDim: simParams.stringDim, vectorScale: simParams.vectorScale,
                eddingtonRatio: simParams.eddingtonRatio, diskViscosity: simParams.diskViscosity,
                jetLorentzFactor: simParams.jetLorentzFactor,
              }} />
            </div>
          )}

          {activeTab === 'io' && (
            <div className="space-y-3">
              <div className="text-[11px] font-mono text-white/30 uppercase tracking-widest">Parameter mesh topology · input → hidden → output layer visualization</div>
              <IOMeshOverlay inputCount={25} hiddenCount={120} outputCount={4} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
