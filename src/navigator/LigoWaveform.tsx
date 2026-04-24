import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { LIGO_EVENTS, generateStrain, type LigoEvent } from './ligo-events';

interface Props { onSelectEvent?: (event: LigoEvent) => void; }

export function LigoWaveform({ onSelectEvent }: Props) {
  const [selected, setSelected] = useState<LigoEvent>(LIGO_EVENTS[0]);
  const data = useMemo(() => generateStrain(selected, 800), [selected]);
  const handleSelect = (e: LigoEvent) => { setSelected(e); onSelectEvent?.(e); };
  const typeColor: Record<string, string> = { BBH: '#f97316', BNS: '#10b981', NSBH: '#8b5cf6' };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {LIGO_EVENTS.map(e => (
          <button key={e.id} onClick={() => handleSelect(e)}
            className={`h-7 px-2.5 rounded-lg border font-mono text-[10px] transition-all ${selected.id === e.id ? 'bg-orange-500/20 border-orange-500/60 text-orange-300' : 'bg-white/4 border-white/10 text-white/50 hover:bg-white/8 hover:text-white/80'}`}>
            {e.name}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-orange-400">{selected.name} — strain h(t)</div>
            <div className="font-mono text-[9px] text-white/30 mt-0.5">{selected.date} · {selected.type} · {selected.distance_mpc} Mpc</div>
          </div>
          <span className="rounded-lg border px-2 py-0.5 font-mono text-[10px]"
            style={{ color: typeColor[selected.type], borderColor: typeColor[selected.type] + '40', background: typeColor[selected.type] + '15' }}>
            SNR {selected.snr}
          </span>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: -20, bottom: 10 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={(v) => v.toFixed(2)}
                label={{ value: 't (s, merger=0)', fontSize: 9, fill: 'rgba(255,255,255,0.3)', position: 'insideBottom', offset: -5 }} />
              <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                label={{ value: 'h(t)×10⁻²¹', angle: -90, fontSize: 9, fill: 'rgba(255,255,255,0.3)', position: 'insideLeft', offset: 10 }} />
              <Tooltip contentStyle={{ background: '#0a0a14', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, fontFamily: 'monospace' }} formatter={(v: number) => [v.toFixed(3), 'h(t)']} />
              <ReferenceLine x={0} stroke="rgba(249,115,22,0.5)" strokeDasharray="4 2"
                label={{ value: 'merger', fontSize: 8, fill: 'rgba(249,115,22,0.7)', position: 'top' }} />
              <Line type="monotone" dataKey="h" stroke="#f97316" strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-mono border-t border-white/5 pt-3 md:grid-cols-4">
          {[{ l: 'M₁', v: `${selected.m1} M☉` }, { l: 'M₂', v: `${selected.m2} M☉` },
            { l: 'M_remnant', v: `${selected.m_final} M☉` }, { l: 'a_final', v: selected.a_final.toFixed(2) }].map(x => (
            <div key={x.l}><div className="text-white/25">{x.l}</div><div className="text-orange-400">{x.v}</div></div>
          ))}
        </div>
        <div className="mt-2 text-[8px] text-white/20 leading-relaxed">{selected.notes}</div>
      </div>
      <div className="text-[9px] text-white/20 font-mono">Ref: GWTC-3 catalog (Abbott et al., 2021) · Post-Newtonian inspiral + Berti 2009 QNM ringdown</div>
    </div>
  );
}
