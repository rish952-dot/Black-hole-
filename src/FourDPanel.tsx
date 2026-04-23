import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Minus } from 'lucide-react';

interface FourDPanelProps {
  mass: number;
  spin: number;
  offset4D: number;
  coupling: number;
  onClose: () => void;
}

// 4D hypercube vertices (all ±1 combinations in 4D)
const VERTICES_4D: [number, number, number, number][] = [];
for (let a = -1; a <= 1; a += 2)
  for (let b = -1; b <= 1; b += 2)
    for (let c = -1; c <= 1; c += 2)
      for (let d = -1; d <= 1; d += 2)
        VERTICES_4D.push([a, b, c, d]);

// Edges of a tesseract: connect vertices differing in exactly one coordinate
const EDGES_4D: [number, number][] = [];
for (let i = 0; i < VERTICES_4D.length; i++) {
  for (let j = i + 1; j < VERTICES_4D.length; j++) {
    let diff = 0;
    for (let k = 0; k < 4; k++) if (VERTICES_4D[i][k] !== VERTICES_4D[j][k]) diff++;
    if (diff === 1) EDGES_4D.push([i, j]);
  }
}

// Rotate in a 4D plane
function rotate4D(v: [number, number, number, number], plane: [number, number], angle: number): [number, number, number, number] {
  const [i, j] = plane;
  const res: [number, number, number, number] = [...v];
  res[i] = v[i] * Math.cos(angle) - v[j] * Math.sin(angle);
  res[j] = v[i] * Math.sin(angle) + v[j] * Math.cos(angle);
  return res;
}

// Project 4D → 3D (perspective)
function project4Dto3D(v: [number, number, number, number], w_dist: number): [number, number, number] {
  const f = 1 / (w_dist - v[3]);
  return [v[0] * f, v[1] * f, v[2] * f];
}

// Project 3D → 2D (perspective)
function project3Dto2D(v: [number, number, number], eye_z: number, cx: number, cy: number, scale: number): [number, number] {
  const f = eye_z / (eye_z + v[2]);
  return [cx + v[0] * scale * f, cy + v[1] * scale * f];
}

type SpacetimeNode = { x: number; y: number; curv: number };

const SPACETIME_GRID_SIZE = 12;
const OVERLAP_DAMPING = 0.72;

export const FourDPanel: React.FC<FourDPanelProps> = ({ mass, spin, offset4D, coupling, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const dragRef = useRef({ dragging: false, lx: 0, ly: 0, rx: 0.3, ry: 0.5 });
  const panelRef = useRef<HTMLDivElement>(null);
  const panelDragRef = useRef({ dragging: false, startX: 0, startY: 0, panelX: 0, panelY: 0 });
  const workerRef = useRef<Worker | null>(null);
  const workerBusyRef = useRef(false);
  const spacetimeNodesRef = useRef<SpacetimeNode[]>([]);
  const lastWorkerTickRef = useRef(0);

  const [pos, setPos] = useState({ x: window.innerWidth / 2 - 300, y: 60 });
  const [minimized, setMinimized] = useState(false);
  const [mode, setMode] = useState<'tesseract' | 'spacetime' | 'penrose'>('tesseract');

  const paramsRef = useRef({ mass, spin, offset4D, coupling });
  useEffect(() => { paramsRef.current = { mass, spin, offset4D, coupling }; }, [mass, spin, offset4D, coupling]);

  useEffect(() => {
    const worker = new Worker(new URL('./fourDWorker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent<{ mode: string; packed: Float32Array }>) => {
      if (e.data.mode !== 'FOUR_D_NODES') return;
      const packed = e.data.packed;
      const nodes: SpacetimeNode[] = [];
      for (let i = 0; i < packed.length; i += 3) {
        nodes.push({ x: packed[i], y: packed[i + 1], curv: packed[i + 2] });
      }
      spacetimeNodesRef.current = nodes;
      workerBusyRef.current = false;
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      workerBusyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || minimized) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      const p = paramsRef.current;
      tRef.current += 0.016;
      const t = tRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(5,3,12,0.95)';
      ctx.fillRect(0, 0, W, H);

      const drag = dragRef.current;
      const cx = W / 2;
      const cy = H / 2;

      if (mode === 'tesseract') {
        // --- 4D TESSERACT with BH metric deformation ---
        const rot_xy = t * 0.18 + drag.rx;
        const rot_xw = t * 0.11 + p.offset4D;
        const rot_yw = t * 0.09 + p.spin * 0.5;
        const rot_zw = t * 0.07 + p.coupling * 0.01;

        const projected = VERTICES_4D.map(v => {
          let r = rotate4D(v, [0, 1], rot_xy);
          r = rotate4D(r, [0, 3], rot_xw);
          r = rotate4D(r, [1, 3], rot_yw);
          r = rotate4D(r, [2, 3], rot_zw);

          // BH metric deformation: warp w-component by Schwarzschild factor
          const rs = p.mass * 0.04;
          const rr = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]) + 0.01;
          const schwarzFactor = Math.sqrt(Math.max(0.01, 1 - rs / rr));
          r[3] *= schwarzFactor;

          const v3 = project4Dto3D(r, 2.5);
          const [px2, py2] = project3Dto2D(v3, 3.0, cx, cy, 120);
          return { px: px2, py: py2, w: r[3], depth: v3[2] };
        });

        // Draw edges — sort by depth for painter's algorithm
        const edgesWithDepth = EDGES_4D.map(([i, j]) => ({
          i, j,
          depth: (projected[i].depth + projected[j].depth) / 2,
          wAvg: (projected[i].w + projected[j].w) / 2
        })).sort((a, b) => a.depth - b.depth);

        edgesWithDepth.forEach(({ i, j, wAvg }) => {
          const a = projected[i], b = projected[j];
          const t4d = (wAvg + 1) / 2;
          const r = Math.round(138 + t4d * 80);
          const g = Math.round(43 + t4d * 150);
          const bl = Math.round(226 - t4d * 100);
          const alpha = 0.25 + Math.abs(wAvg) * 0.4;

          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha})`;
          ctx.lineWidth = 0.8 + Math.abs(wAvg) * 1.2;
          ctx.stroke();
        });

        // Draw vertices
        projected.forEach(v => {
          const t4d = (v.w + 1) / 2;
          const isActive = Math.abs(v.w) > 0.6;
          const radius = 2.5 + Math.abs(v.w) * 2;

          if (isActive) {
            const grd = ctx.createRadialGradient(v.px, v.py, 0, v.px, v.py, radius * 4);
            grd.addColorStop(0, `rgba(139,92,246,0.5)`);
            grd.addColorStop(1, `rgba(139,92,246,0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(v.px, v.py, radius * 4, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(v.px, v.py, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${139 + t4d * 80}, ${92 + t4d * 140}, 246, ${0.5 + t4d * 0.5})`;
          ctx.fill();
        });

        // Labels
        ctx.fillStyle = 'rgba(139,92,246,0.5)';
        ctx.font = '8px monospace';
        ctx.fillText(`4D Tesseract — Kerr-deformed (a=${p.spin.toFixed(2)})`, 12, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText(`W-plane offset: ${p.offset4D.toFixed(3)} rad`, 12, 30);
        ctx.fillText(`16 vertices · 32 edges · Schwarzschild warp active`, 12, 42);

      } else if (mode === 'spacetime') {
        // --- 4D SPACETIME CURVATURE GRID ---
        if (!workerBusyRef.current && workerRef.current && t - lastWorkerTickRef.current > 0.03) {
          workerBusyRef.current = true;
          lastWorkerTickRef.current = t;
          workerRef.current.postMessage({ mode: 'FOUR_D_TICK', mass: p.mass, spin: p.spin, t, gridSize: SPACETIME_GRID_SIZE });
        }

        const GRID = SPACETIME_GRID_SIZE;
        const nodes = spacetimeNodesRef.current;
        const scale = Math.min(W, H) / 5.5;

        if (nodes.length !== GRID * GRID) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.font = '11px monospace';
          ctx.fillText('Initializing 4D parallel network…', 12, 20);
          animRef.current = requestAnimationFrame(draw);
          return;
        }

        // Draw curved grid lines
        for (let i = 0; i < GRID; i++) {
          ctx.beginPath();
          for (let j = 0; j < GRID; j++) {
            const n = nodes[i * GRID + j];
            const curv = n.curv;
            const px = cx + n.x * scale + Math.sin(t * 0.5 + i) * curv * (8 * OVERLAP_DAMPING);
            const py = cy + n.y * scale + curv * (20 * OVERLAP_DAMPING);
            j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          const grad = ctx.createLinearGradient(cx - W / 2, 0, cx + W / 2, 0);
          grad.addColorStop(0, 'rgba(59,130,246,0.1)');
          grad.addColorStop(0.5, 'rgba(139,92,246,0.35)');
          grad.addColorStop(1, 'rgba(59,130,246,0.1)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        for (let j = 0; j < GRID; j++) {
          ctx.beginPath();
          for (let i = 0; i < GRID; i++) {
            const n = nodes[i * GRID + j];
            const curv = n.curv;
            const px = cx + n.x * scale + Math.sin(t * 0.5 + j) * curv * (8 * OVERLAP_DAMPING);
            const py = cy + n.y * scale + curv * (20 * OVERLAP_DAMPING);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.strokeStyle = 'rgba(99,102,241,0.2)';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }

        // Nodes with curvature glow
        nodes.forEach(n => {
          if (n.curv < 0.1) return;
          const px = cx + n.x * scale + Math.sin(t * 0.5) * n.curv * (8 * OVERLAP_DAMPING);
          const py = cy + n.y * scale + n.curv * (20 * OVERLAP_DAMPING);
          const r = 1.5 + n.curv * 4;

          if (n.curv > 0.5) {
            const grd = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
            grd.addColorStop(0, `rgba(139,92,246,${n.curv * 0.6})`);
            grd.addColorStop(1, `rgba(0,0,0,0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(px, py, r * 5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167,139,250,${Math.min(1, n.curv * 1.5)})`;
          ctx.fill();
        });

        // Event horizon
        const rs = p.mass * 0.25 * scale;
        if (rs > 5) {
          const ehGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rs);
          ehGrd.addColorStop(0, 'rgba(0,0,0,1)');
          ehGrd.addColorStop(0.8, 'rgba(0,0,0,0.9)');
          ehGrd.addColorStop(1, 'rgba(139,92,246,0.4)');
          ctx.fillStyle = ehGrd;
          ctx.beginPath();
          ctx.arc(cx, cy, rs, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(139,92,246,0.6)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(139,92,246,0.5)';
        ctx.font = '8px monospace';
        ctx.fillText(`Spacetime Curvature — 4D projection (z→w)`, 12, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText(`M=${p.mass.toFixed(1)} (sim)  a=${p.spin.toFixed(3)}  r_s=${(p.mass * 0.25).toFixed(2)}  damping=${OVERLAP_DAMPING.toFixed(2)}`, 12, 30);

      } else {
        // --- PENROSE DIAGRAM (Conformal causal structure) ---
        const s = Math.min(W, H) * 0.38;

        // Conformal boundaries
        ctx.save();
        ctx.translate(cx, cy);

        // Outer diamond (Minkowski region)
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.8, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.8, 0);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(99,102,241,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Future/past singularity
        const singX = s * 0.35;
        ctx.beginPath();
        ctx.moveTo(-singX, -s * 0.55);
        ctx.lineTo(singX, -s * 0.55);
        ctx.strokeStyle = 'rgba(239,68,68,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(-singX, s * 0.55);
        ctx.lineTo(singX, s * 0.55);
        ctx.strokeStyle = 'rgba(239,68,68,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Event horizon lines
        const ehPos = -s * 0.1 + Math.sin(t * 0.3) * s * 0.02 * p.spin;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5 + ehPos, -s * 0.5);
        ctx.lineTo(s * 0.5 + ehPos, s * 0.5);
        ctx.strokeStyle = 'rgba(251,146,60,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(s * 0.5 + ehPos, -s * 0.5);
        ctx.lineTo(-s * 0.5 + ehPos, s * 0.5);
        ctx.strokeStyle = 'rgba(251,146,60,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Null geodesics from observer
        for (let k = -3; k <= 3; k++) {
          const angle = (k / 6) * 0.8;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const ex = (Math.sin(Math.PI / 4 + angle) + 0.01) * s;
          const ey = -Math.cos(Math.PI / 4 + angle) * s;
          ctx.lineTo(ex, ey);
          const alpha = 0.15 - Math.abs(k) * 0.02;
          ctx.strokeStyle = `rgba(59,130,246,${Math.max(0.03, alpha)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }

        // Region labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('i⁺ (future)', 0, -s * 0.9);
        ctx.fillText('i⁻ (past)', 0, s * 0.95);
        ctx.fillText('BH interior', 0, -s * 0.2);
        ctx.fillStyle = 'rgba(239,68,68,0.5)';
        ctx.fillText('singularity', 0, -s * 0.62);
        ctx.textAlign = 'left';

        // Observer worldline
        const osc = Math.sin(t * 0.4) * s * 0.05;
        ctx.beginPath();
        ctx.moveTo(0 + osc, s * 0.5);
        ctx.quadraticCurveTo(s * 0.05, 0, 0 + osc * 0.5, -s * 0.3);
        ctx.strokeStyle = 'rgba(16,185,129,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();

        ctx.fillStyle = 'rgba(139,92,246,0.5)';
        ctx.font = '8px monospace';
        ctx.fillText(`Penrose–Carter Diagram — ${p.spin > 0.01 ? 'Kerr' : 'Schwarzschild'} BH`, 12, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText(`Causal structure · Future singularity (dashed) · EH (orange)`, 12, 30);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Mouse rotation for tesseract
    const onDown = (e: MouseEvent) => { dragRef.current.dragging = true; dragRef.current.lx = e.clientX; dragRef.current.ly = e.clientY; };
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      dragRef.current.rx += (e.clientX - dragRef.current.lx) * 0.01;
      dragRef.current.ry += (e.clientY - dragRef.current.ly) * 0.01;
      dragRef.current.lx = e.clientX;
      dragRef.current.ly = e.clientY;
    };
    const onUp = () => { dragRef.current.dragging = false; };
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [minimized, mode]);

  // Panel drag
  const onPanelMouseDown = useCallback((e: React.MouseEvent) => {
    panelDragRef.current = { dragging: true, startX: e.clientX - pos.x, startY: e.clientY - pos.y, panelX: pos.x, panelY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!panelDragRef.current.dragging) return;
      setPos({ x: ev.clientX - panelDragRef.current.startX, y: ev.clientY - panelDragRef.current.startY });
    };
    const onUp = () => { panelDragRef.current.dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      style={{ left: pos.x, top: pos.y, width: 560, zIndex: 100 }}
      className="fixed rounded-2xl overflow-hidden shadow-2xl border border-purple-500/30 bg-[#05030c]/95 backdrop-blur-xl"
    >
      {/* Title bar — draggable */}
      <div
        onMouseDown={onPanelMouseDown}
        className="flex items-center justify-between px-4 py-3 bg-purple-950/60 border-b border-purple-500/20 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
          <span className="text-xs font-semibold text-purple-300 tracking-wide">4D Spacetime Explorer</span>
          <span className="text-[10px] text-purple-500/60">Isolated Computation</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(m => !m)} className="p-1.5 rounded-lg hover:bg-purple-500/20 text-purple-400/60 hover:text-purple-300 transition-all">
            <Minus size={12} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-500/20 text-purple-400/60 hover:text-red-400 transition-all">
            <X size={12} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Mode switcher */}
          <div className="flex gap-1 p-3 border-b border-purple-500/10">
            {([
              { id: 'tesseract', label: '4D Tesseract' },
              { id: 'spacetime', label: 'Spacetime Grid' },
              { id: 'penrose', label: 'Penrose Diagram' }
            ] as const).map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all ${mode === m.id ? 'bg-purple-600/40 text-purple-200 border border-purple-500/40' : 'text-purple-500/50 hover:text-purple-300 hover:bg-purple-900/30'}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full cursor-grab active:cursor-grabbing block"
            style={{ height: 340 }}
          />

          {/* Stats footer */}
          <div className="px-4 py-3 bg-purple-950/40 border-t border-purple-500/10 grid grid-cols-4 gap-3">
            {[
              { label: 'Mass (sim)', value: mass.toFixed(2) },
              { label: 'Spin a*', value: spin.toFixed(4) },
              { label: 'W-Offset', value: offset4D.toFixed(3) },
              { label: 'Coupling λ', value: coupling.toFixed(2) }
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[9px] text-purple-500/50 uppercase tracking-wider mb-0.5">{s.label}</div>
                <div className="text-xs font-mono text-purple-300">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tip */}
          <div className="px-4 py-2 text-[9px] text-purple-500/30 font-mono border-t border-purple-500/10">
            {mode === 'tesseract' ? 'Drag canvas to rotate · Edges colored by 4th dimension (W) · Schwarzschild warping applied' :
             mode === 'spacetime' ? 'Spacetime curvature tensor projected onto XY plane · Purple nodes = high curvature zones' :
             'Penrose–Carter conformal diagram · Orange = event horizon · Red = singularity · Green = observer worldline'}
          </div>
        </>
      )}
    </motion.div>
  );
};
