interface Props {
  inputCount: number;
  hiddenCount: number;
  outputCount: number;
}

export function IOMeshOverlay({ inputCount, hiddenCount, outputCount }: Props) {
  const inputs = [
    'mass', 'spin', 'diskInner', 'diskOuter', 'diskTilt',
    'doppler', 'lensing', 'exposure', 'darkMatter', 'haloScale',
    'stringDim', 'frameDrag', 'redshift', 'vectorScale',
    'eddingtonRatio', 'diskViscosity', 'jetLorentzFactor',
    'stellarDispersion', 'mSigmaAlpha', 'darkMatterConc',
    'massRatio', 'chirpMass', 'orbitalEcc', 'finalMergerSpin',
    's2Eccentricity',
  ].slice(0, inputCount);

  const outputs = ['pixel colour', 'disk emission', 'lensing angle', 'GW strain'];

  const maxNodes = Math.max(inputCount, hiddenCount, outputs.length);
  const nodeH = Math.max(28, Math.floor(480 / maxNodes));

  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white/80">I/O Parameter Mesh</div>
          <div className="text-[10px] text-white/30 mt-0.5">{inputCount} inputs · {hiddenCount} hidden · {outputs.length} outputs</div>
        </div>
        <div className="flex gap-2 text-[9px] font-mono">
          <span className="px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/25">inputs</span>
          <span className="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-400 border border-violet-500/25">hidden</span>
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">outputs</span>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {/* Inputs */}
        <div className="flex flex-col gap-0.5 shrink-0">
          {inputs.map((n, i) => (
            <div key={i} style={{ height: nodeH }} className="flex items-center">
              <div className="px-2 py-0.5 rounded-l-md bg-orange-500/10 border border-orange-500/20 text-[8px] font-mono text-orange-400/70 truncate max-w-[100px]">{n}</div>
              <div className="h-px w-3 bg-orange-500/20" />
            </div>
          ))}
        </div>

        {/* Hidden layer dots */}
        <div className="flex flex-col gap-0.5 justify-center shrink-0">
          {Array.from({ length: Math.min(hiddenCount, 20) }).map((_, i) => (
            <div key={i} style={{ height: Math.max(8, Math.floor(360 / Math.min(hiddenCount, 20))) }}
              className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-violet-500/60 border border-violet-400/40" />
            </div>
          ))}
          {hiddenCount > 20 && <div className="text-[8px] text-white/20 font-mono">+{hiddenCount - 20}</div>}
        </div>

        {/* Outputs */}
        <div className="flex flex-col gap-3 justify-center shrink-0">
          {outputs.map((n, i) => (
            <div key={i} className="flex items-center gap-0">
              <div className="h-px w-3 bg-cyan-500/20" />
              <div className="px-2 py-0.5 rounded-r-md bg-cyan-500/10 border border-cyan-500/20 text-[8px] font-mono text-cyan-400/70">{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
