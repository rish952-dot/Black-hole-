import { useMemo } from 'react';

interface SimParams {
  mass: number;
  spin: number;
  frameDrag: number;
  diskInner: number;
  diskOuter: number;
  diskTilt?: number;
  doppler?: number;
  lensing?: number;
  darkMatter: number;
  haloScale?: number;
  stringDim?: number;
  vectorScale?: number;
  eddingtonRatio?: number;
  diskViscosity?: number;
  jetLorentzFactor?: number;
}

interface Props { params: SimParams; }

function Cell({ k, v, unit = '' }: { k: string; v: string | number; unit?: string }) {
  const val = typeof v === 'number' ? v.toFixed(4) : v;
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 py-0.5">
      <span className="text-white/30">{k}</span>
      <span className="text-white/80 font-mono text-[10px]">{val}<span className="ml-0.5 text-white/30">{unit}</span></span>
    </div>
  );
}

export function DataMatrix({ params }: Props) {
  const r_s = 2 * params.mass;
  const r_isco = 6 * params.mass;
  const r_photon = 3 * params.mass;
  const r_eval = 10 * params.mass;

  const g = useMemo(() => {
    const r = r_eval;
    const f = 1 - r_s / r;
    return { tt: -f, rr: 1 / f, thth: r * r, phph: r * r };
  }, [r_eval, r_s]);

  const inputs: [string, number, string][] = [
    ['mass', params.mass, 'M☉'], ['spin a/M', params.spin, ''],
    ['frame_drag', params.frameDrag, ''], ['disk_inner', params.diskInner, 'r_s'],
    ['disk_outer', params.diskOuter, 'r_s'], ['dark_matter', params.darkMatter, ''],
    ['eddington_λ', params.eddingtonRatio ?? 0, ''], ['α_viscosity', params.diskViscosity ?? 0.12, ''],
    ['jet_Γ', params.jetLorentzFactor ?? 1, ''], ['vector_scale', params.vectorScale ?? 1, '×'],
  ];

  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-white/3 p-3 font-mono text-[10px]">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-orange-400">Input Vector · {inputs.length}D</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0 md:grid-cols-3">
          {inputs.map(([k, v, u]) => <Cell key={k} k={k} v={v} unit={u} />)}
        </div>
      </div>
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-violet-400">Derived Metric Scalars</div>
        <div className="grid grid-cols-2 gap-x-4 md:grid-cols-4">
          {[
            { k: 'r_s', v: r_s.toFixed(4), u: 'M' }, { k: 'r_ISCO', v: r_isco.toFixed(4), u: 'M' },
            { k: 'r_photon', v: r_photon.toFixed(4), u: 'M' }, { k: 'r_eval', v: r_eval.toFixed(4), u: 'M' },
            { k: 'f(r_eval)', v: (1 - r_s / r_eval).toFixed(6), u: '' }, { k: 'v_ISCO', v: Math.sqrt(1 / (6)).toFixed(4), u: 'c' },
            { k: 'E_bind', v: (1 - Math.sqrt(8 / 9)).toFixed(6), u: 'Mc²' }, { k: 'Ω_H', v: (params.spin / (2 * r_s)).toFixed(6), u: 'M⁻¹' },
          ].map(c => <Cell key={c.k} k={c.k} v={c.v} unit={c.u} />)}
        </div>
      </div>
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400">g_μν at r=10r_s (equatorial)</div>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
          {[
            { k: 'g_tt', v: g.tt }, { k: 'g_rr', v: g.rr },
            { k: 'g_θθ', v: g.thth }, { k: 'g_φφ', v: g.phph }
          ].map(c => (
            <div key={c.k} className="rounded-lg bg-white/4 border border-white/5 p-2 text-center">
              <div className="text-[9px] text-white/30">{c.k}</div>
              <div className="text-[10px] text-cyan-400 font-mono mt-0.5">{c.v.toFixed(6)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
