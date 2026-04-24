import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface Props {
  mass: number;
  spin: number;
  diskInner: number;
  diskOuter: number;
  darkMatter: number;
  haloScale: number;
}

export function MathGraphs({ mass, spin, diskInner, diskOuter, darkMatter, haloScale }: Props) {
  const r_s = 2 * mass;
  const data = useMemo(() => {
    const arr: Array<{ r: number; Veff: number; T: number; redshift: number; DM: number }> = [];
    const r_in = diskInner * r_s;
    const rh = Math.max(haloScale * r_s, 1);
    for (let i = 0; i < 120; i++) {
      const r = r_s * 1.05 + (i / 119) * (diskOuter * r_s * 1.5);
      const L = 4 * mass;
      const Veff = (1 - r_s / r) * (1 + (L * L) / (r * r)) - 1;
      const cutoff = r > r_in ? 1 - Math.sqrt(r_in / r) : 0;
      const T = Math.pow(r / r_s, -0.75) * Math.max(cutoff, 0) * 100;
      const redshift = r > r_s ? Math.sqrt(1 - r_s / r) : 0;
      const x = r / rh;
      const Menc = darkMatter * (Math.log(1 + x) - x / (1 + x));
      arr.push({ r: +(r / r_s).toFixed(2), Veff: +Veff.toFixed(4), T: +T.toFixed(3), redshift: +redshift.toFixed(3), DM: +Menc.toFixed(3) });
    }
    return arr;
  }, [mass, diskInner, diskOuter, darkMatter, haloScale, r_s]);

  return (
    <div className="space-y-3">
      <Chart title="V_eff(r) — Effective Potential" subtitle="Schwarzschild + NFW dark matter"
        data={data} keys={[{ key: 'Veff', color: '#f97316', name: 'V_eff' }]} />
      <Chart title="T(r) — Disk Temperature (Shakura-Sunyaev)" subtitle={`Inner edge ${diskInner.toFixed(1)} r_s`}
        data={data} keys={[{ key: 'T', color: '#06b6d4', name: 'T(r) ∝ r⁻³/⁴' }]} />
      <Chart title="z(r) — Gravitational Redshift" subtitle="√(1 − r_s/r)"
        data={data} keys={[{ key: 'redshift', color: '#10b981', name: 'redshift' }]} />
      <Chart title="M_DM(r) — NFW Enclosed Dark Matter" subtitle={`spin a/M=${spin.toFixed(2)}`}
        data={data} keys={[{ key: 'DM', color: '#a78bfa', name: 'M_DM' }]} />
    </div>
  );
}

function Chart({ title, subtitle, data, keys }: { title: string; subtitle?: string; data: any[]; keys: { key: string; color: string; name: string }[] }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="mb-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-orange-400">{title}</div>
        {subtitle && <div className="font-mono text-[9px] text-white/30">{subtitle}</div>}
      </div>
      <div className="h-[130px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
            <XAxis dataKey="r" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} label={{ value: 'r/r_s', fontSize: 8, fill: 'rgba(255,255,255,0.3)', position: 'insideBottom', offset: -1 }} />
            <YAxis tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} />
            <Tooltip contentStyle={{ background: '#0a0a14', border: '1px solid rgba(255,255,255,0.1)', fontSize: 10, fontFamily: 'monospace' }} />
            <Legend wrapperStyle={{ fontSize: 9, fontFamily: 'monospace' }} />
            {keys.map(k => <Line key={k.key} type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={1.5} dot={false} name={k.name} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
