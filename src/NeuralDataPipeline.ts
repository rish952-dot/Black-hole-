import { useRef, useEffect, useState } from 'react';
import { globalPhysicsEngine } from './PhysicsEngine';

interface ParameterMap {
  [key: string]: number;
}

interface DataFeedback {
  nodes: any[];
  edges: any[];
  signals: any[];
  stability: number;
}

/**
 * Data Pipeline for Neural Mesh
 * Transforms raw simulation signals into normalized, structured inputs.
 * Uses lightweight frame skipping and heuristic clustering to prevent thread blocking.
 */
export function useNeuralDataPipeline(
  rawParams: ParameterMap,
  throttleFrames: number = 5
) {
  const [dataFeed, setDataFeed] = useState<DataFeedback>({
    nodes: [],
    edges: [],
    signals: [],
    stability: 1.0
  });

  const stateRef = useRef({
    frameCount: 0,
    history: [] as ParameterMap[],
    variance: {} as ParameterMap,
    stability: 1.0,
    clusters: [] as { id: string; weight: number; center: number }[]
  });

  useEffect(() => {
    stateRef.current.frameCount++;
    if (stateRef.current.frameCount % throttleFrames !== 0) return;

    const t0 = performance.now();
    const st = stateRef.current;

    // SYNC PHYSICS ENGINE
    globalPhysicsEngine.updateParams(
        rawParams.mass || 1.0,
        rawParams.spin || 0.0,
        rawParams.charge || 0.0,
        rawParams.modelType || 0
    );

    const physicsMetrics = globalPhysicsEngine.getGlobalMetrics();

    // 1. DATA NORMALIZATION (Log scaling and clamping)
    const normalized: ParameterMap = {};
    for (const [key, val] of Object.entries(rawParams)) {
      if (typeof val !== 'number') continue;
      // Logarithmic scaling for high-range values like mass or starCount
      if (key === 'mass' || key === 'starCount') {
        normalized[key] = Math.max(0, Math.min(1, Math.log10(val + 1) / 10));
      } else {
        // Standard min/max assumed mapping
        normalized[key] = Math.max(0, Math.min(1, val));
      }
    }

    // Add physics derived normalized values
    normalized['globalEnergy'] = Math.log10(physicsMetrics.global_energy + 1) / 10;
    normalized['entropy'] = Math.log10(physicsMetrics.entropy_estimate + 1) / 10;
    normalized['horizonRadius'] = Math.min(1, physicsMetrics.horizon_radius / 10);

    // Push to history
    st.history.push(normalized);
    if (st.history.length > 20) st.history.shift();

    // 2. DERIVED METRICS (Variance, delta)
    const deltas: ParameterMap = {};
    let totalVar = 0;
    
    if (st.history.length > 1) {
      const prev = st.history[st.history.length - 2];
      for (const key of Object.keys(normalized)) {
        deltas[key] = normalized[key] - (prev[key] || 0);
        
        // Rolling variance
        const avg = st.history.reduce((sum, h) => sum + (h[key] || 0), 0) / st.history.length;
        const v = st.history.reduce((sum, h) => sum + Math.pow((h[key] || 0) - avg, 2), 0) / st.history.length;
        st.variance[key] = v;
        totalVar += v;
      }
    }

    // Stability Inverse to variance and gwAmplitude
    let baseInstability = totalVar * 5;
    if (rawParams.gwAmplitude) baseInstability += rawParams.gwAmplitude * 0.2;
    st.stability = Math.max(0, 1.0 - baseInstability);

    // 3. CORRELATION MAPPING & CLUSTERING (Heuristic)
    const nodes = [];
    const edges = [];
    const signals = [];

    const keys = Object.keys(normalized);
    
    // Group into clusters
    for (let i = 0; i < keys.length; i++) {
        nodes.push({
            id: `node_${keys[i]}`,
            val: normalized[keys[i]],
            delta: deltas[keys[i]] || 0,
            variance: st.variance[keys[i]] || 0
        });

        // Edge mapping based on heuristic correlation
        if (i > 0) {
            const corr = Math.abs((normalized[keys[i]] || 0) - (normalized[keys[i-1]] || 0));
            edges.push({
                source: `node_${keys[i-1]}`,
                target: `node_${keys[i]}`,
                weight: 1.0 - corr // similar values = stronger edge
            });
        }
    }

    // Produce Signals for the Neural Mesh
    if (baseInstability > 0.05) {
        signals.push({ type: 'INSTABILITY', magnitude: baseInstability });
    }

    // Apply strict budget per frame
    if (performance.now() - t0 > 8) {
        console.warn('DataPipeline: Dropping frame computation due to timeout limit');
        return;
    }

    setDataFeed({
        nodes,
        edges,
        signals,
        stability: st.stability
    });

  }, [rawParams, throttleFrames]);

  return dataFeed;
}
