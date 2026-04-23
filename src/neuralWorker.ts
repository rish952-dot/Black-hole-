
self.onmessage = (e) => {
  if (e.data.mode === 'NEURAL_TICK') {
    const { nodes, weights, activity } = e.data;
    const count = nodes.length;
    const nextNodes = new Float32Array(count);
    
    // Dense matrix multiplication to stress CPU
    // This is O(N^2) - with 1024 nodes, this is 1M ops per tick
    for (let i = 0; i < count; i++) {
      let sum = 0;
      const offset = i * count;
      for (let j = 0; j < count; j++) {
        sum += nodes[j] * weights[offset + j];
      }
      nextNodes[i] = nodes[i] * 0.95 + Math.tanh(sum) * 0.05 + (Math.random() - 0.5) * 0.001;
    }
    
    // Simulated massive RAM access - reading/writing to a large buffer
    const ramStress = new Float32Array(1024 * 1024 * 16); // 64MB per worker
    for(let i=0; i<ramStress.length; i+=1024) ramStress[i] = Math.random();

    // @ts-ignore
    self.postMessage({ nodes: nextNodes, activity: Math.random() }, [nextNodes.buffer]);
  }
};
