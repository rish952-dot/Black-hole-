// Intelligent Neural Mesh Physics & Data Transformation Subsystem v2

import { PhysicsEngine } from './PhysicsEngine';
import { blackHoleFieldToMeshData, meshDataToSignal } from './FieldBridge';

let positions: Float32Array;      // x, y, z
let positions4D: Float32Array;    // w (4th dimension)

const physics = new PhysicsEngine();
let velocities: Float32Array;     // vx, vy, vz
let basePositions: Float32Array;
let energies: Float32Array;
let nodeTypes: Uint8Array;        // 0=CORE, 1=DYNAMIC, 2=PERIPHERAL, 3=ANOMALY, 4=4D_NODE
let nodeStates: Uint8Array;       // 0=NORMAL, 1=FROZEN, 2=QUARANTINED
let nodeTensions: Float32Array;
let edges: Uint32Array;
let edgeWeights: Float32Array;

let isRunning = false;
let nodeCount = 0;
let baseNodeCount = 1500;
let node4DCount = 800;
let edgeCount = 0;
let time = 0;

// Simulation State
let currentParams = { mass: 1.0, spin: 0.0, distance: 10.0, charge: 0.0, coupling: 1.0, timeScale: 1.0, debugMode: false, autoHeal: true, sensitivty: 0.5, modelType: 0 };
let prevParams = { ...currentParams };
let globalEntropy = 0.5;
let anomalyLevel = 0.0;
let stabilityIndex = 1.0;

// Tuning
const REPULSION_BASE = 0.8;
const SPRING_K_BASE = 0.015;
const DAMPING = 0.90;
const MAX_VEL = 4.0;
const IDEAL_LEN = 4.0;

self.onmessage = (e) => {
  const { type, payload } = e.data;
  
  if (type === 'INIT') {
    baseNodeCount = payload.numNodes;
    node4DCount = 800; // Force 800 4D nodes
    nodeCount = baseNodeCount + node4DCount;
    edgeCount = payload.numEdges + 1000; // Extra edges for 4D
    
    positions = new Float32Array(nodeCount * 3);
    positions4D = new Float32Array(nodeCount);
    velocities = new Float32Array(nodeCount * 3);
    basePositions = new Float32Array(nodeCount * 3);
    energies = new Float32Array(nodeCount);
    nodeTypes = new Uint8Array(nodeCount);
    nodeStates = new Uint8Array(nodeCount);
    nodeTensions = new Float32Array(nodeCount);
    
    edges = new Uint32Array(edgeCount * 2);
    edgeWeights = new Float32Array(edgeCount);
    
    // Cluster assignments for dimensional projection
    const NUM_CLUSTERS = 5;
    const clusters = Array.from({ length: NUM_CLUSTERS }, () => ({
      x: (Math.random() - 0.5) * 40,
      y: (Math.random() - 0.5) * 40,
      z: (Math.random() - 0.5) * 40
    }));

    // Initialize Base Nodes
    for (let i = 0; i < baseNodeCount; i++) {
        initNode(i, false, clusters);
    }
    // Initialize 4D Nodes
    for (let i = baseNodeCount; i < nodeCount; i++) {
        initNode(i, true, clusters);
    }
    
    // Initialize Edges (Barabási–Albert preferential attachment approx)
    let eIdx = 0;
    for (let i = 1; i < nodeCount; i++) {
      const maxConn = nodeTypes[i] === 0 ? 4 : (nodeTypes[i] === 1 ? 2 : (nodeTypes[i] === 4 ? 3 : 1));
      const connections = Math.floor(Math.random() * maxConn) + 1;
      for (let c = 0; c < connections; c++) {
        if (eIdx >= edgeCount) break;
        const target = Math.floor(Math.random() * i);
        edges[eIdx * 2] = i;
        edges[eIdx * 2 + 1] = target;
        edgeWeights[eIdx] = Math.random() * 0.5 + 0.5;
        eIdx++;
      }
    }
    while (eIdx < edgeCount) {
        edges[eIdx * 2] = Math.floor(Math.random() * nodeCount);
        edges[eIdx * 2 + 1] = Math.floor(Math.random() * nodeCount);
        edgeWeights[eIdx] = Math.random() * 0.3;
        eIdx++;
    }
    
    self.postMessage({ type: 'INIT_ACK', edges: edges.slice(), types: nodeTypes.slice() });
    isRunning = true;
    loop();
  } else if (type === 'UPDATE_PARAMS') {
    prevParams = { ...currentParams };
    currentParams = { ...currentParams, ...payload };
    
    physics.updateParams(
        currentParams.mass || 1.0, 
        currentParams.spin || 0.0, 
        currentParams.charge || 0.0, 
        currentParams.modelType || 0
    );
    
    const feed = payload.pipelineFeed;
    if (feed) {
        // Use physically derived stability
        stabilityIndex = feed.stability;
        anomalyLevel = Math.max(0, 1.0 - stabilityIndex);
        
        // Feed drives global system states directly
        globalEntropy = 1.0 - (stabilityIndex * 0.5) + (anomalyLevel * 0.5);
    } else {
        // Fallback
        let delta = Math.abs(currentParams.mass - prevParams.mass) + 
                    Math.abs(currentParams.spin - prevParams.spin) * 2.0 +
                    Math.abs(currentParams.charge - prevParams.charge);
        
        anomalyLevel = Math.min(1.0, anomalyLevel + delta * (5.0 * currentParams.sensitivty));
        globalEntropy = 0.5 + Math.sin(time * 0.001) * 0.2 + anomalyLevel * 0.3;
    }
    
    if (anomalyLevel > 0.3 && Math.random() < 0.2 * currentParams.sensitivty) {
        const idx = Math.floor(Math.random() * baseNodeCount);
        if(nodeStates[idx] === 0) { // If normal
            nodeTypes[idx] = 3; // Anomaly
            energies[idx] = 2.0;
            self.postMessage({ type: 'ANOMALY_DETECTED' });
        }
    }
  } else if (type === 'INTERACT_NODE') {
      // User tapped a node
      const { index, action } = payload;
      if (index >= 0 && index < nodeCount) {
          if (action === 'FREEZE') nodeStates[index] = 1;
          if (action === 'UNFREEZE') nodeStates[index] = 0;
          if (action === 'QUARANTINE') nodeStates[index] = 2;
          if (action === 'BOOST') energies[index] += 5.0;
      }
  } else if (type === 'TRIGGER_GW') {
      // Gravitational Wave Pulse
      for(let i=0; i<nodeCount; i++) {
          if(nodeStates[i] === 0) {
              energies[i] += 1.5;
              velocities[i*3] += (Math.random()-0.5) * 5.0;
              velocities[i*3+1] += (Math.random()-0.5) * 5.0;
              velocities[i*3+2] += (Math.random()-0.5) * 5.0;
          }
      }
  }
};

function initNode(i: number, is4D: boolean, clusters: any[]) {
    const i3 = i * 3;
    let nType = 2;
    if (is4D) {
        nType = 4;
        positions4D[i] = (Math.random() - 0.5) * Math.PI * 2; // Initial W phase
    } else {
        const r = Math.random();
        if (r < 0.1) nType = 0;      
        else if (r < 0.5) nType = 1; 
    }
    
    nodeTypes[i] = nType;
    nodeStates[i] = 0; // NORMAL
    energies[i] = Math.random();

    const clusterId = Math.floor(Math.random() * clusters.length);
    const cx = clusters[clusterId].x, cy = clusters[clusterId].y, cz = clusters[clusterId].z;
    const spread = nType === 0 ? 5 : (nType === 1 ? 15 : 25);
    
    positions[i3] = basePositions[i3] = cx + (Math.random() - 0.5) * spread;
    positions[i3 + 1] = basePositions[i3 + 1] = cy + (Math.random() - 0.5) * spread;
    positions[i3 + 2] = basePositions[i3 + 2] = cz + (Math.random() - 0.5) * spread;
    
    velocities[i3] = velocities[i3 + 1] = velocities[i3 + 2] = 0;
}

const requestAnimationFrame = (self as any).requestAnimationFrame || ((cb: Function) => setTimeout(cb, 16));

function loop() {
  if (!isRunning) return;
  simulate();
  time++;
  
  (self as any).postMessage({ 
      type: 'TICK', 
      positions: positions.slice(),
      energies: energies.slice(),
      types: nodeTypes.slice(),
      states: nodeStates.slice(),
      metrics: { anomalyLevel, globalEntropy, stabilityIndex }
  }, [positions.slice().buffer, energies.slice().buffer]);
  
  anomalyLevel *= 0.98;
  
  requestAnimationFrame(loop);
}

function simulate() {
  const speed = currentParams.timeScale * 0.5 + 0.5;
  const repulsion = REPULSION_BASE * (1.0 + globalEntropy);
  const springK = SPRING_K_BASE * (1.0 + currentParams.coupling);
  
  let totalVel = 0;
  let unstableCount = 0;

  // 1. Repulsion & Internal Forces
  for (let i = 0; i < nodeCount; i++) {
    if (nodeStates[i] === 1) continue; // FROZEN nodes do not process physics
    
    const i3 = i * 3;
    let fx = 0, fy = 0, fz = 0;
    
    for (let s = 0; s < 40; s++) {
      const j = Math.floor(Math.random() * nodeCount);
      if (i === j || nodeStates[j] === 2) continue; // Ignore Quarantined
      
      const j3 = j * 3;
      const dx = positions[i3] - positions[j3];
      const dy = positions[i3 + 1] - positions[j3 + 1];
      const dz = positions[i3 + 2] - positions[j3 + 2];
      
      let distSq = dx*dx + dy*dy + dz*dz;
      if (distSq < 0.1) distSq = 0.1;
      
      if (distSq < 150.0) {
        const force = repulsion / distSq;
        fx += dx * force;
        fy += dy * force;
        fz += dz * force;
      }
    }
    
    // Map field properties to mesh nodes
    const field = physics.getField(positions[i3], positions[i3+1], positions[i3+2]);
    const meshData = blackHoleFieldToMeshData(field, {x: positions[i3], y: positions[i3+1], z: positions[i3+2]});
    
    fx += meshData.forceX;
    fy += meshData.forceY;
    fz += meshData.forceZ;
    
    fx -= positions[i3] * meshData.gravityScale;
    fy -= positions[i3+1] * meshData.gravityScale;
    fz -= positions[i3+2] * meshData.gravityScale;
    
    nodeTensions[i] = meshData.tension;
    
    energies[i] = Math.max(0, Math.min(2.0, energies[i] + meshData.energyBoost - 0.01));
    
    if (meshData.anomalyTrigger && nodeStates[i] === 0) {
        nodeTypes[i] = 3;
        energies[i] = 2.0;
        const signal = meshDataToSignal(nodeStates[i], nodeTypes[i], energies[i], i);
        if (signal) (self as any).postMessage(signal);
    }

    
    velocities[i3] += fx;
    velocities[i3 + 1] += fy;
    velocities[i3 + 2] += fz;
    
    // 4D projection math (rotate latent pos across W)
    if (nodeTypes[i] === 4) {
        positions4D[i] += 0.01 * speed; // Advance W phase
        // Subtle Spatial Shift based on 4D rotation (X-W plane approx)
        const wShift = Math.sin(positions4D[i]);
        velocities[i3] += wShift * 0.1; 
        velocities[i3+1] += Math.cos(positions4D[i]) * 0.05;
    }
    
    if (nodeTypes[i] === 3 && Math.random() < 0.02) nodeTypes[i] = 1; // recover anomaly
    energies[i] += (Math.random() * 0.1 - 0.05);
    energies[i] *= 0.95; 

    // Error checking (NaN / Divergence)
    const vMagSq = velocities[i3]*velocities[i3] + velocities[i3+1]*velocities[i3+1] + velocities[i3+2]*velocities[i3+2];
    if (isNaN(vMagSq) || vMagSq > 1000.0) {
        unstableCount++;
        // Self-Healing Trigger
        if (currentParams.autoHeal) {
            velocities[i3] = velocities[i3+1] = velocities[i3+2] = 0;
            positions[i3] = basePositions[i3];
            positions[i3+1] = basePositions[i3+1];
            positions[i3+2] = basePositions[i3+2];
            nodeStates[i] = 2; // Quarantine to stabilize
            nodeTypes[i] = 3;  // Mark anomaly
        }
    }
  }
  
  stabilityIndex = Math.max(0, 1.0 - (unstableCount / nodeCount));

  // 2. Spring Forces & Healing
  for (let i = 0; i < edgeCount; i++) {
    const src = edges[i * 2];
    const tgt = edges[i * 2 + 1];
    if (nodeStates[src] === 1 || nodeStates[tgt] === 1) continue; // Skip frozen
    
    // Weak edges for Quarantined
    let w = edgeWeights[i];
    if (nodeStates[src] === 2 || nodeStates[tgt] === 2) w *= 0.05;
    
    const s3 = src * 3;
    const t3 = tgt * 3;
    
    const dx = positions[t3] - positions[s3];
    const dy = positions[t3 + 1] - positions[s3 + 1];
    const dz = positions[t3 + 2] - positions[s3 + 2];
    
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.01;
    
    // Reconstruct broken long edges in Auto-Heal
    if (currentParams.autoHeal && dist > 100.0 && Math.random() < 0.1) {
        edges[i * 2 + 1] = Math.floor(Math.random() * nodeCount); // rebind
        continue;
    }

    const force = (dist - IDEAL_LEN) * springK * w * ((nodeTensions[src] + nodeTensions[tgt]) * 0.5);
    
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    const fz = (dz / dist) * force;
    
    velocities[s3] += fx;
    velocities[s3 + 1] += fy;
    velocities[s3 + 2] += fz;
    
    velocities[t3] -= fx;
    velocities[t3 + 1] -= fy;
    velocities[t3 + 2] -= fz;
    
    const eDiff = (energies[tgt] - energies[src]) * 0.1 * w;
    energies[src] += eDiff;
    energies[tgt] -= eDiff;
  }
  
  // 3. Integrate with Global Oscillation
  const breath = Math.sin(time * 0.02) * 0.05 * currentParams.charge;

  for (let i = 0; i < nodeCount; i++) {
    if (nodeStates[i] === 1) continue;

    const i3 = i * 3;
    let vDamp = DAMPING;
    if (nodeStates[i] === 2) vDamp = 0.5; // High damping for quarantined
    else if (nodeTypes[i] === 0) vDamp -= 0.05;
    
    let vx = velocities[i3] * vDamp;
    let vy = velocities[i3 + 1] * vDamp;
    let vz = velocities[i3 + 2] * vDamp;
    
    const vMagSq = vx*vx + vy*vy + vz*vz;
    if (vMagSq > MAX_VEL*MAX_VEL) {
        const f = MAX_VEL / Math.sqrt(vMagSq);
        vx *= f; vy *= f; vz *= f;
    }
    
    velocities[i3] = vx;
    velocities[i3 + 1] = vy;
    velocities[i3 + 2] = vz;
    
    positions[i3] += vx * speed + positions[i3] * breath;
    positions[i3 + 1] += vy * speed + positions[i3+1] * breath;
    positions[i3 + 2] += vz * speed + positions[i3+2] * breath;
    
    // Auto-unquarantine
    if (nodeStates[i] === 2 && currentParams.autoHeal && Math.random() < 0.005) {
        nodeStates[i] = 0;
        nodeTypes[i] = 1;
    }
  }
}


