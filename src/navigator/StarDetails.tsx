import { useState } from 'react';
import { FEATURED_STARS, tempToHex, type FeaturedStar } from './featured-stars';

export function StarDetails() {
  const [selected, setSelected] = useState<FeaturedStar>(FEATURED_STARS[0]);
  const spectralColor: Record<string, string> = {
    BH: '#ef4444', NS: '#a855f7', O: '#93c5fd', B: '#bfdbfe', A: '#e0f2fe',
    F: '#fef9c3', G: '#fde68a', K: '#fdba74', M: '#fca5a5', WD: '#d1d5db'
  };

  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-[240px_1fr]">
      <div className="overflow-auto max-h-[60vh] md:max-h-none rounded-xl border border-white/8 bg-white/3">
        <div className="p-2 space-y-0.5">
          {FEATURED_STARS.map(s => {
            const hex = s.spectral === 'BH' ? '#ff2244' : s.spectral === 'NS' ? '#aa66ff' : tempToHex(s.temperature_k || 5500);
            return (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`group flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-all ${selected.id === s.id ? 'border-orange-500/40 bg-orange-500/10' : 'border-transparent hover:border-white/10 hover:bg-white/5'}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex, boxShadow: `0 0 6px ${hex}` }} />
                <span className="flex-1 font-mono text-[10px] text-white/80 truncate">{s.name}</span>
                <span className="font-mono text-[8px] shrink-0 px-1 rounded" style={{ color: spectralColor[s.spectral] ?? '#aaa', background: (spectralColor[s.spectral] ?? '#aaa') + '15' }}>{s.spectral}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-white/8 bg-white/3 p-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-white/90">{selected.name}</h3>
            <p className="font-mono text-[9px] text-white/30 uppercase tracking-widest mt-0.5">{selected.spectral} · {selected.catalog} · {selected.agency}</p>
          </div>
          <span className="shrink-0 rounded-lg border px-2 py-0.5 font-mono text-[10px]"
            style={{ color: spectralColor[selected.spectral] ?? '#aaa', borderColor: (spectralColor[selected.spectral] ?? '#aaa') + '40', background: (spectralColor[selected.spectral] ?? '#aaa') + '10' }}>
            {selected.spectral}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mb-4 leading-relaxed">{selected.notes}</p>

        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono md:grid-cols-3">
          {[
            { l: 'RA (deg)', v: selected.ra.toFixed(5) },
            { l: 'Dec (deg)', v: selected.dec.toFixed(5) },
            { l: 'Distance', v: selected.distance_pc > 1e6 ? `${(selected.distance_pc / 1e6).toFixed(2)} Mpc` : selected.distance_pc < 0.1 ? `${(selected.distance_pc * 3.086e13).toFixed(2)} km` : `${selected.distance_pc.toFixed(2)} pc` },
            { l: 'Magnitude V', v: selected.magnitude > 90 ? 'N/A' : selected.magnitude.toFixed(2) },
            { l: 'Mass', v: selected.mass_solar < 1e4 ? `${selected.mass_solar.toExponential(2)} M☉` : `${(selected.mass_solar).toExponential(2)} M☉` },
            { l: 'Radius', v: selected.radius_solar < 1e-3 ? `${selected.radius_solar.toExponential(1)} R☉` : `${selected.radius_solar.toFixed(2)} R☉` },
            { l: 'Temperature', v: selected.temperature_k > 0 ? `${(selected.temperature_k / 1000).toFixed(2)} kK` : 'N/A (BH)' },
            { l: 'B-V Color', v: selected.bv_color.toFixed(2) },
            { l: 'Spectral', v: selected.spectral },
          ].map(x => (
            <div key={x.l} className="border-b border-white/5 py-1.5">
              <div className="text-white/25 text-[9px]">{x.l}</div>
              <div className="text-orange-400">{x.v}</div>
            </div>
          ))}
        </div>

        <a href={`https://simbad.u-strasbg.fr/simbad/sim-basic?Ident=${encodeURIComponent(selected.name)}&submit=SIMBAD+search`}
          target="_blank" rel="noopener noreferrer"
          className="mt-4 flex items-center gap-1.5 text-[10px] font-mono text-orange-400/60 hover:text-orange-400 transition-colors">
          Open in SIMBAD →
        </a>
      </div>
    </div>
  );
}
