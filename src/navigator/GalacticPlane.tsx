import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "./utils";
import { useIsMobile } from "./use-mobile";

interface Props { className?: string; }

export type GalaxyType = "spiral" | "elliptical" | "irregular" | "colliding";
const GALAXY_TYPES: { id: GalaxyType; label: string }[] = [
  { id: "spiral", label: "Spiral" },
  { id: "elliptical", label: "Elliptical" },
  { id: "irregular", label: "Irregular" },
  { id: "colliding", label: "Colliding pair" },
];

export function GalacticPlane({ className }: Props) {
  const isMobile = useIsMobile();
  const [age, setAge] = useState(8.0);
  const [playing, setPlaying] = useState(true);
  const [particleCount] = useState(isMobile ? 3000 : 8000);
  const [resetKey, setResetKey] = useState(0);
  const [type, setType] = useState<GalaxyType>("spiral");
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => { setAge((a) => (a >= 13.8 ? 0.5 : a + 0.05 * speed)); }, 60);
    return () => clearInterval(t);
  }, [playing, speed]);

  return (
    <div className={cn("relative h-full w-full min-h-[500px] overflow-hidden rounded-xl border border-white/8 bg-black", className)}>
      <Canvas gl={{ antialias: true, powerPreference: "high-performance" }} dpr={[1, isMobile ? 1.2 : 1.6]} camera={{ position: [0, 30, 50], fov: 55 }}>
        <color attach="background" args={["#020208"]} />
        <ambientLight intensity={0.25} />
        <pointLight position={[0, 0, 0]} intensity={3} color="#ffaa55" distance={80} />
        <Galaxy key={`${resetKey}-${type}`} count={particleCount} age={age} type={type} speed={speed} />
        <DarkMatterHalo radius={60} />
        <GalacticCenter />
        <OrbitControls enableDamping dampingFactor={0.08} minDistance={10} maxDistance={200} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 space-y-1">
        <div className="rounded-lg border border-violet-500/40 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-violet-400">
          {type} · {particleCount.toLocaleString()} bodies
        </div>
        <div className="rounded-lg border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] text-white/40">
          age = <span className="text-orange-400">{age.toFixed(2)}</span> Gyr · {phaseLabel(age, type)}
        </div>
      </div>

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        {GALAXY_TYPES.map((g) => (
          <button key={g.id}
            className={`h-7 px-3 rounded-lg border font-mono text-[10px] transition-all text-left ${type === g.id ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' : 'bg-black/60 border-white/10 text-white/50 hover:bg-white/8 hover:text-white/80'}`}
            onClick={() => { setType(g.id); setResetKey((k) => k + 1); }}>
            {g.label}
          </button>
        ))}
      </div>

      <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/70 p-3 backdrop-blur-sm space-y-2">
        <div className="flex items-center gap-2">
          <button className="h-7 w-7 p-0 flex items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/60 hover:text-white transition-colors"
            onClick={() => setPlaying((p) => !p)}>
            {playing ? '⏸' : '▶'}
          </button>
          <button className="h-7 w-7 p-0 flex items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/60 hover:text-white transition-colors"
            onClick={() => { setAge(0.5); setResetKey((k) => k + 1); }}>
            ↺
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/30">Cosmic time</span>
          <span className="ml-auto font-mono text-xs text-orange-400">{age.toFixed(2)} Gyr / 13.8</span>
        </div>
        <input type="range" min={0.1} max={13.8} step={0.05} value={age}
          onChange={(e) => { setAge(Number(e.target.value)); setPlaying(false); }}
          className="w-full accent-orange-500 h-1.5 cursor-pointer" />
        <div className="flex justify-between font-mono text-[8px] text-white/25">
          <span>cloud</span><span>protogalaxy</span><span>arms form</span><span>mature spiral</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/25 shrink-0">
            Time-lapse ×{speed.toFixed(1)}
          </span>
          <input type="range" min={0.1} max={20} step={0.1} value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="flex-1 accent-violet-500 h-1.5 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

function phaseLabel(age: number, type: GalaxyType): string {
  if (type === "elliptical") {
    if (age < 2) return "Major merger remnant cooling";
    if (age < 6) return "Violent relaxation · stellar mixing";
    return "Quenched elliptical · old red population";
  }
  if (type === "irregular") return "Irregular dwarf · stochastic SF";
  if (type === "colliding") {
    if (age < 4) return "Approach phase · tidal tails forming";
    if (age < 9) return "First passage · starburst";
    return "Coalescence · merger remnant";
  }
  if (age < 1) return "Primordial gas cloud collapsing";
  if (age < 3) return "Protogalaxy · halo virialization";
  if (age < 6) return "Disk formation · bar instability";
  if (age < 10) return "Spiral arms developing";
  return "Mature barred spiral · ongoing star formation";
}

function Galaxy({ count, age, type, speed }: { count: number; age: number; type: GalaxyType; speed: number; }) {
  const ref = useRef<THREE.Points>(null);
  const init = useMemo(() => {
    const arr: { r0: number; phi0: number; z0: number; arm: number; sub: number }[] = [];
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      let r0: number, z0: number, sub = 0;
      if (type === "elliptical") { r0 = Math.pow(-Math.log(1 - u * 0.95), 4) * 0.6 + 0.5; z0 = (Math.random() - 0.5) * r0 * 0.7; }
      else if (type === "irregular") { r0 = -Math.log(1 - u * 0.95) * 5 + 0.5; z0 = (Math.random() - 0.5) * 4; }
      else if (type === "colliding") { sub = Math.random() < 0.5 ? -1 : 1; r0 = -Math.log(1 - u * 0.95) * 4 + 0.5; z0 = (Math.random() - 0.5) * Math.exp(-r0 / 6) * 1.2; }
      else { r0 = -Math.log(1 - u * 0.95) * 6 + 0.5; z0 = (Math.random() - 0.5) * Math.exp(-r0 / 8) * 1.5; }
      const arm = Math.floor(Math.random() * 2);
      const phi0 = Math.random() * Math.PI * 2;
      arr.push({ r0, phi0, z0, arm, sub });
    }
    return arr;
  }, [count, type]);

  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    const m = Math.min(1, Math.max(0, (age - 0.5) / 8));
    for (let i = 0; i < count; i++) {
      const s = init[i];
      const puff = (1 - m) * 25;
      const r = s.r0 * (0.4 + 0.6 * m) + puff * (Math.random() - 0.5) * 0.02;
      const v = 0.6 / Math.sqrt(Math.max(r, 0.5));
      const omega = v / Math.max(r, 0.3);
      const phi = s.phi0 + omega * t * 4;
      const armPhase = phi - 0.6 * Math.log(Math.max(r, 0.5));
      const armStrength = type === "spiral" ? 0.4 : type === "irregular" ? 0.1 : 0.0;
      const armBias = m * armStrength * Math.cos(2 * armPhase + s.arm * Math.PI);
      const r_eff = r + armBias;
      let x = r_eff * Math.cos(phi), y = s.z0 * (1 - m * 0.7), zCoord = r_eff * Math.sin(phi);
      if (type === "elliptical") { y = s.z0 * 0.8; x = r_eff * Math.cos(phi) * 1.3; zCoord = r_eff * Math.sin(phi); }
      else if (type === "irregular") { x += Math.sin(s.phi0 * 7 + t * 0.3) * 1.5; zCoord += Math.cos(s.phi0 * 5 + t * 0.4) * 1.5; }
      else if (type === "colliding") { const sep = 18 * Math.cos(t * 0.05) * Math.exp(-age / 20); x += s.sub * sep; zCoord += s.sub * Math.sin(t * 0.05) * 5; }
      positions[i * 3 + 0] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = zCoord;
      const armBoost = Math.max(0, Math.cos(2 * armPhase)) * m * (type === "spiral" ? 1 : 0);
      const cloudTint = 1 - m;
      const rad = r / 10;
      if (type === "elliptical") { colors[i*3]=0.9; colors[i*3+1]=0.55; colors[i*3+2]=0.35; }
      else if (type === "colliding") { const burst = Math.sin(s.phi0 * 3 + t) * 0.5 + 0.5; colors[i*3]=0.5+burst*0.4; colors[i*3+1]=0.6+burst*0.2; colors[i*3+2]=0.7+burst*0.3; }
      else { colors[i*3]=0.6+armBoost*0.3+cloudTint*0.2; colors[i*3+1]=0.5+(1-rad)*0.3-cloudTint*0.2; colors[i*3+2]=0.4+armBoost*0.5+cloudTint*0.5; }
    }
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (ref.current.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  });

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial size={0.18} vertexColors transparent opacity={0.85} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function DarkMatterHalo({ radius }: { radius: number }) {
  return <mesh><sphereGeometry args={[radius, 24, 24]} /><meshBasicMaterial color="#3a1a6a" transparent opacity={0.05} side={THREE.BackSide} /></mesh>;
}

function GalacticCenter() {
  return (
    <>
      <mesh><sphereGeometry args={[1, 24, 24]} /><meshBasicMaterial color="#000" /></mesh>
      <mesh><sphereGeometry args={[2.5, 24, 24]} /><meshBasicMaterial color="#ffaa55" transparent opacity={0.15} /></mesh>
    </>
  );
}
