const scratchRam = new Float32Array(1024 * 1024 * 2); // ~8MB reusable buffer

self.onmessage = (e) => {
  if (e.data.mode === 'NEURAL_TICK') {
    const { nodes, weights, activity, stride = 512 } = e.data;
    const count = nodes.length;
    const nextNodes = new Float32Array(count);

    // Dense matrix multiplication with controllable stride to reduce pressure
    for (let i = 0; i < count; i++) {
      let sum = 0;
      const offset = i * count;
      for (let j = 0; j < count; j += 1) {
        sum += nodes[j] * weights[offset + j];
      }
      nextNodes[i] = nodes[i] * 0.95 + Math.tanh(sum) * 0.05 + (Math.random() - 0.5) * 0.0005;
    }

    // Reused RAM-touch pattern (no per-tick massive allocations)
    for (let i = 0; i < scratchRam.length; i += stride) {
      scratchRam[i] = (scratchRam[i] + Math.random() * 0.001 + activity * 0.0005) % 1;
    }

    // @ts-ignore
    self.postMessage({ nodes: nextNodes, activity: Math.random() }, [nextNodes.buffer]);
  }
};
