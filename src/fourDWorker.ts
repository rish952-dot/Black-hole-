interface FourDTickPayload {
  mode: 'FOUR_D_TICK';
  mass: number;
  spin: number;
  t: number;
  gridSize: number;
}

const clamp = (v: number, mn: number, mx: number) => Math.min(mx, Math.max(mn, v));

self.onmessage = (e: MessageEvent<FourDTickPayload>) => {
  if (e.data.mode !== 'FOUR_D_TICK') return;

  const { mass, spin, t, gridSize } = e.data;
  const nodeCount = gridSize * gridSize;
  const packed = new Float32Array(nodeCount * 3);

  let ptr = 0;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const px = (i / (gridSize - 1) - 0.5) * 4;
      const py = (j / (gridSize - 1) - 0.5) * 4;
      const r2 = px * px + py * py + 0.01;
      const r = Math.sqrt(r2);
      const rs = mass * 0.25;
      const kerrTerm = spin * rs * Math.sin(t * 0.3) / (r2 + 0.1);
      const curv = clamp(rs / r + kerrTerm * 0.3, -0.5, 1);

      packed[ptr++] = px;
      packed[ptr++] = py;
      packed[ptr++] = curv;
    }
  }

  // @ts-ignore
  self.postMessage({ mode: 'FOUR_D_NODES', gridSize, packed }, [packed.buffer]);
};
