import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { cn } from "./utils";

interface Props { mass: number; spin: number; diskInner: number; diskOuter: number; className?: string; }

export function AccretionDiskStudy({ mass, spin, diskInner, diskOuter, className }: Props) {
  const r_s = 2 * mass;
  const r_isco = 6 * mass;

  const profile = useMemo(() => {
    const arr: { r: number; T: number; F: number; v: number; lambda: number }[] = [];
    const rIn = diskInner * r_s;
    const rOut = diskOuter * r_s;
    const T0 = 1.0e7;
    const sigma = 5.67e-8;
    for (let i = 0; i < 80; i++) {
      const r = rIn + ((rOut - rIn) * i) / 79;
      const cutoff = Math.pow(Math.max(1 - Math.sqrt(rIn / r), 0.001), 0.25);
      const T = T0 * Math.pow(r / r_s, -0.75) * cutoff;
      const F = sigma * Math.pow(T, 4);
      const v = Math.sqrt(mass / r);
      const lambda = (2.898e-3 / T) * 1e9;
      arr.push({ r: +(r / r_s).toFixed(2), T: +(T / 1e6).toFixed(3), F: +(F / 1e15).toFixed(3), v: +v.toFixed(3), lambda: +lambda.toFixed(2) });
    }
    return arr;
  }, [mass, diskInner, diskOuter, r_s]);

  const luminosity = useMemo(() => {
    let L = 0;
    for (let i = 1; i < profile.length; i++) {
      const r1 = profile[i - 1].r * r_s;
      const r2 = profile[i].r * r_s;
      const F = (profile[i - 1].F + profile[i].F) * 0.5 * 1e15;
      L += 2 * Math.PI * ((r1 + r2) * 0.5) * F * (r2 - r1);
    }
    return L;
  }, [profile, r_s]);

  const Tmax = profile.reduce((m, p) => Math.max(m, p.T), 0);
  const lambdaMin = profile.reduce((m, p) => Math.min(m, p.lambda), 1e9);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { l: 'r_s', v: r_s.toFixed(3), u: 'GM/c²', c: '#f97316' },
          { l: 'r_ISCO', v: r_isco.toFixed(3), u: 'GM/c²', c: '#06b6d4' },
          { l: 'L_disk', v: (luminosity / 1e30).toExponential(2), u: '×10³⁰ W', c: '#8b5cf6' },
          { l: 'T_max', v: Tmax.toFixed(2), u: 'MK', c: '#ef4444' },
        ].map(s => (
          <div key={s.l} className="rounded-xl border bg-white/3 px-3 py-2" style={{ borderColor: s.c + '40', color: s.c }}>
            <div className="font-mono text-[9px] uppercase tracking-widest opacity-70">{s.l}</div>
            <div className="font-mono text-sm font-bold">{s.v}</div>
            <div className="font-mono text-[9px] opacity-60">{s.u}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative h-[280px] overflow-hidden rounded-xl border border-white/8 bg-black">
          <Canvas gl={{ antialias: true, powerPreference: "high-performance" }} dpr={[1, 1.5]} camera={{ position: [0, 12, 22], fov: 50 }}>
            <color attach="background" args={["#02030a"]} />
            <ambientLight intensity={0.3} />
            <pointLight position={[0, 0, 0]} intensity={5} color="#ffaa55" distance={40} />
            <DiskMesh mass={mass} spin={spin} diskInner={diskInner} diskOuter={diskOuter} />
            <EventHorizon r_s={r_s} />
            <IscoRing r_isco={r_isco} />
            <OrbitControls enableDamping dampingFactor={0.08} minDistance={5} maxDistance={80} touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }} />
          </Canvas>
          <div className="pointer-events-none absolute left-2 top-2">
            <span className="px-2 py-0.5 rounded-lg border border-violet-500/40 bg-violet-500/10 font-mono text-[9px] text-violet-400">
              Thin-disk · Shakura-Sunyaev · a={spin.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <ProfileGraph data={profile} yKey="T" label="T(r) — temperature" color="#ef4444" yLabel="MK" />
          <ProfileGraph data={profile} yKey="v" label="v_orb(r)/c — Keplerian" color="#f97316" yLabel="c" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ProfileGraph data={profile} yKey="F" label="F(r) — radiative flux" color="#06b6d4" yLabel="×10¹⁵ W/m²" />
        <ProfileGraph data={profile} yKey="lambda" label="λ_peak(r) — Wien displacement" color="#8b5cf6" yLabel="nm" marker={lambdaMin} />
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 p-3 font-mono text-[9px] leading-relaxed text-white/30">
        <div className="mb-1 text-violet-400">DISK PHYSICS</div>
        T(r) = T₀(r/r_s)^(-3/4) [1−√(r_in/r)]^(1/4)<br />
        F(r) = σT⁴ · L = ∫2πr F(r) dr<br />
        λ_peak = 2.898e-3/T (Wien) · v_orb = √(GM/r)<br />
        ISCO r=6M (Schwarzschild) · spin a={spin.toFixed(2)}
      </div>
    </div>
  );
}

function ProfileGraph({ data, yKey, label, color, yLabel, marker }: { data: { r: number; T: number; F: number; v: number; lambda: number }[]; yKey: "T"|"F"|"v"|"lambda"; label: string; color: string; yLabel: string; marker?: number; }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-2">
      <div className="mb-1 px-1 font-mono text-[10px] uppercase tracking-widest text-white/30">{label}</div>
      <div className="h-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
            <XAxis dataKey="r" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} label={{ value: 'r/r_s', fontSize: 9, fill: 'rgba(255,255,255,0.3)', position: 'insideBottom', offset: -2 }} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} label={{ value: yLabel, fontSize: 9, fill: 'rgba(255,255,255,0.3)', angle: -90, position: 'insideLeft' }} />
            <Tooltip contentStyle={{ background: '#0a0a14', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, fontFamily: 'monospace' }} />
            {marker !== undefined && <ReferenceLine y={marker} stroke="#06b6d4" strokeDasharray="3 3" />}
            <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DiskMesh({ mass, spin, diskInner, diskOuter }: { mass: number; spin: number; diskInner: number; diskOuter: number; }) {
  const ref = useRef<THREE.Mesh>(null);
  const r_s = 2 * mass;
  const rIn = diskInner * r_s;
  const rOut = diskOuter * r_s;
  const { geom } = useMemo(() => {
    const g = new THREE.RingGeometry(rIn, rOut, 128, 32);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const r = Math.sqrt(x * x + y * y);
      const T = Math.pow(r / r_s, -0.75);
      const k = Math.min(1, T * 0.7);
      cols[i * 3 + 0] = 0.4 + k * 0.6;
      cols[i * 3 + 1] = 0.2 + k * 0.6;
      cols[i * 3 + 2] = 0.05 + k * 0.9;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.rotateX(-Math.PI / 2);
    return { geom: g };
  }, [rIn, rOut, r_s]);
  useFrame((s) => { if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.4 * (1 + spin); });
  return <mesh ref={ref} geometry={geom}><meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.92} /></mesh>;
}

function EventHorizon({ r_s }: { r_s: number }) {
  return <mesh><sphereGeometry args={[r_s, 32, 32]} /><meshBasicMaterial color="#000" /></mesh>;
}

function IscoRing({ r_isco }: { r_isco: number }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[r_isco * 0.99, r_isco * 1.01, 64]} /><meshBasicMaterial color="#00ffaa" side={THREE.DoubleSide} transparent opacity={0.7} /></mesh>;
}
