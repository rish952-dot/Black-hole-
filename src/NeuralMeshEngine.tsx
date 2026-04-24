import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

const BASE_NODE_COUNT = 1500;
const NODE_COUNT_4D = 800; // 4D Layer
const NODE_COUNT = BASE_NODE_COUNT + NODE_COUNT_4D;
const EDGE_COUNT = 4000;

interface NeuralMeshProps {
  visible: boolean;
  simulationParams: any;
  debugMode?: boolean;
  show4D?: boolean;
  autoHeal?: boolean;
  sensitivity?: number;
  setErrorCount: (c: number | ((prev: number) => number)) => void;
  setMetrics?: (m: any) => void;
}

// Custom Shaders for Nodes
const nodeVertexShader = `
  attribute float energy;
  attribute float nodeType;
  attribute float nodeState;
  
  uniform float uTime;
  uniform float uShow4D;
  uniform float uDebugMode;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    
    if (nodeType == 4.0 && uShow4D < 0.5) {
        vAlpha = 0.0;
        gl_Position = vec4(0.0);
        return;
    }
    
    // Size based on energy and type
    float scale = 1.0 + energy * 2.0;
    if (nodeType == 0.0) scale *= 2.0; // Core
    if (nodeType == 3.0) scale *= 2.5; // Anomaly
    if (nodeType == 4.0) scale *= (1.5 + sin(uTime + energy * 10.0)*0.5); // 4D
    
    // State mods
    if (nodeState == 1.0) scale *= 0.8; // Frozen
    if (nodeState == 2.0) scale *= 0.5; // Quarantined
    
    mvPosition.xyz += position * (scale - 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Color mapping
    if (nodeType == 0.0) vColor = vec3(1.0, 0.4, 0.1); 
    else if (nodeType == 1.0) vColor = vec3(0.1, 0.8, 1.0); 
    else if (nodeType == 3.0) vColor = vec3(1.0, 0.0, 0.2); 
    else if (nodeType == 4.0) vColor = vec3(0.8, 0.2, 1.0); 
    else vColor = vec3(0.5, 0.3, 0.8); 
    
    // Debug overrides
    if (uDebugMode > 0.5) {
        if (nodeState == 1.0) vColor = vec3(0.0, 0.5, 1.0); // Frozen
        if (nodeState == 2.0) vColor = vec3(0.2, 0.2, 0.2); // Quarantined
    }
    
    vColor += vec3(energy * 0.5);
    vAlpha = clamp(0.3 + energy, 0.1, 1.0);
    
    if (nodeType == 4.0) vAlpha *= 0.7; 
    if (nodeState == 2.0) vAlpha *= 0.3; 
  }
`;

const nodeFragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    // Soft particle glow
    float intensity = 1.0 - (dist * 2.0);
    intensity = pow(intensity, 1.5);
    
    gl_FragColor = vec4(vColor * intensity * 1.5, vAlpha * intensity);
  }
`;

const GraphLayer = ({ positions, edges, energies, types, states, simParams, debugMode, show4D, workerRef }: any) => {
  const nodeMeshRef = useRef<THREE.InstancedMesh>(null);
  const lineGeometryRef = useRef<THREE.BufferGeometry>(null);
  const lineMaterialRef = useRef<THREE.LineBasicMaterial>(null);
  
  const { camera, pointer, raycaster } = useThree();
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const typeAttr = useMemo(() => new Float32Array(NODE_COUNT), []);
  const energyAttr = useMemo(() => new Float32Array(NODE_COUNT), []);
  const stateAttr = useMemo(() => new Float32Array(NODE_COUNT), []);

  const uniforms = useMemo(() => ({
      uTime: { value: 0 },
      uShow4D: { value: show4D ? 1.0 : 0.0 },
      uDebugMode: { value: debugMode ? 1.0 : 0.0 }
  }), []);

  // Material memory
  const customMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: nodeVertexShader,
    fragmentShader: nodeFragmentShader,
    uniforms: uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }), [uniforms]);

  useEffect(() => {
    uniforms.uShow4D.value = show4D ? 1.0 : 0.0;
    uniforms.uDebugMode.value = debugMode ? 1.0 : 0.0;
  }, [show4D, debugMode, uniforms]);

  useEffect(() => {
    if (nodeMeshRef.current) {
      nodeMeshRef.current.geometry.setAttribute('nodeType', new THREE.InstancedBufferAttribute(typeAttr, 1));
      nodeMeshRef.current.geometry.setAttribute('energy', new THREE.InstancedBufferAttribute(energyAttr, 1));
      nodeMeshRef.current.geometry.setAttribute('nodeState', new THREE.InstancedBufferAttribute(stateAttr, 1));
    }
  }, []);

  // Interaction
  useEffect(() => {
      const handlePointerDown = (e: MouseEvent) => {
          if (!nodeMeshRef.current || !positions) return;
          raycaster.setFromCamera(pointer, camera);
          
          let closestIdx = -1;
          let closestDist = Infinity;
          for(let i=0; i<NODE_COUNT; i++) {
              if (!show4D && types && types[i] === 4) continue;
              
              const p = new THREE.Vector3(positions[i*3], positions[i*3+1], positions[i*3+2]);
              p.project(camera);
              
              const dist = new THREE.Vector2(p.x, p.y).distanceTo(pointer);
              if (dist < 0.05 && dist < closestDist) {
                  closestDist = dist;
                  closestIdx = i;
              }
          }
          
          if (closestIdx !== -1 && workerRef.current) {
              const currentState = states ? states[closestIdx] : 0;
              let action = 'BOOST';
              if (e.shiftKey) action = 'QUARANTINE';
              else if (currentState === 0) action = 'FREEZE';
              else if (currentState === 1) action = 'UNFREEZE';
              
              workerRef.current.postMessage({ type: 'INTERACT_NODE', payload: { index: closestIdx, action }});
          }
      };
      
      window.addEventListener('pointerdown', handlePointerDown);
      return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [camera, pointer, raycaster, positions, show4D, types, states, workerRef]);

  useFrame((state) => {
    if (!positions || !types || !energies || !states) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    
    // Update Nodes
    if (nodeMeshRef.current) {
      for (let i = 0; i < NODE_COUNT; i++) {
        dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        dummy.updateMatrix();
        nodeMeshRef.current.setMatrixAt(i, dummy.matrix);
        
        typeAttr[i] = types[i];
        energyAttr[i] = energies[i];
        stateAttr[i] = states[i];
      }
      nodeMeshRef.current.instanceMatrix.needsUpdate = true;
      if (nodeMeshRef.current.geometry.attributes.nodeType) (nodeMeshRef.current.geometry.attributes.nodeType as THREE.InstancedBufferAttribute).needsUpdate = true;
      if (nodeMeshRef.current.geometry.attributes.energy) (nodeMeshRef.current.geometry.attributes.energy as THREE.InstancedBufferAttribute).needsUpdate = true;
      if (nodeMeshRef.current.geometry.attributes.nodeState) (nodeMeshRef.current.geometry.attributes.nodeState as THREE.InstancedBufferAttribute).needsUpdate = true;
    }

    // Update Edges
    if (lineGeometryRef.current && edges) {
        const linePos = new Float32Array(EDGE_COUNT * 6);
        const lineColors = new Float32Array(EDGE_COUNT * 6);
        
        for(let i=0; i<EDGE_COUNT; i++) {
            const s = edges[i*2];
            const t = edges[i*2+1];
            if (s !== undefined && t !== undefined && s < NODE_COUNT && t < NODE_COUNT) {
                if (!show4D && (types[s] === 4 || types[t] === 4)) continue;

                linePos[i*6] = positions[s*3];
                linePos[i*6+1] = positions[s*3+1];
                linePos[i*6+2] = positions[s*3+2];
                linePos[i*6+3] = positions[t*3];
                linePos[i*6+4] = positions[t*3+1];
                linePos[i*6+5] = positions[t*3+2];
                
                // Color edges based on source node type
                let r=0, g=0.5, b=0.8;
                if (types[s] === 0 || types[t] === 0) { r = 1.0; g = 0.3; b = 0.0; } // Core connection
                else if (types[s] === 3 || types[t] === 3) { r = 1.0; g = 0.0; b = 0.0; } // Anomaly broken edge
                else if (types[s] === 4 || types[t] === 4) { r = 0.8; g = 0.2; b = 1.0; } // 4D Layer
                
                if (states[s] === 2 || states[t] === 2) { r *= 0.2; g *= 0.2; b *= 0.2; } // Quarantined
                else if (debugMode && states[s] === 1) { r = 0; g = 0.5; b = 1.0; } // Frozen debug
                
                // Edge pulsing
                const pulse = (Math.sin(state.clock.elapsedTime * 6.0 + i) * 0.5 + 0.5) * energies[s];
                const op = 0.1 + pulse;
                
                lineColors[i*6]   = r*(op+0.5); lineColors[i*6+1] = g*(op+0.5); lineColors[i*6+2] = b*(op+0.5);
                lineColors[i*6+3] = r*op;     lineColors[i*6+4] = g*op;     lineColors[i*6+5] = b*op;
            }
        }
        lineGeometryRef.current.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
        lineGeometryRef.current.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    }
  });

  return (
    <group>
      <instancedMesh ref={nodeMeshRef} args={[undefined, customMaterial, NODE_COUNT]}>
        <planeGeometry args={[0.6, 0.6]} />
      </instancedMesh>
      
      <lineSegments>
        <bufferGeometry ref={lineGeometryRef} />
        <lineBasicMaterial ref={lineMaterialRef} vertexColors transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    </group>
  );
};

export const NeuralMeshEngine: React.FC<NeuralMeshProps> = ({ visible, simulationParams, debugMode, show4D, autoHeal, sensitivity, setErrorCount, setMetrics }) => {
  const [positions, setPositions] = useState<Float32Array | null>(null);
  const [energies, setEnergies] = useState<Float32Array | null>(null);
  const [types, setTypes] = useState<Uint8Array | null>(null);
  const [states, setStates] = useState<Uint8Array | null>(null);
  const [edges, setEdges] = useState<Uint32Array | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!visible) return;

    const worker = new Worker(new URL('./NeuralMeshWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        setPositions(e.data.positions);
        setEnergies(e.data.energies);
        setTypes(e.data.types);
        setStates(e.data.states);
        if (setMetrics) setMetrics(e.data.metrics);
      } else if (e.data.type === 'INIT_ACK') {
        setEdges(e.data.edges);
      } else if (e.data.type === 'ANOMALY_DETECTED') {
        setErrorCount(c => typeof c === 'number' ? c + 1 : 1);
      }
    };

    worker.postMessage({ type: 'INIT', payload: { numNodes: BASE_NODE_COUNT, numEdges: EDGE_COUNT } });

    return () => {
      worker.terminate();
    };
  }, [visible, setErrorCount, setMetrics]);

  useEffect(() => {
    if (workerRef.current && visible) {
        workerRef.current.postMessage({ type: 'UPDATE_PARAMS', payload: { ...simulationParams, debugMode, autoHeal, sensitivty: sensitivity } });
    }
  }, [simulationParams, debugMode, autoHeal, sensitivity, visible]);

  useEffect(() => {
      if (workerRef.current && visible && simulationParams.gwTrigger > 0) {
          workerRef.current.postMessage({ type: 'TRIGGER_GW' });
      }
  }, [simulationParams.gwTrigger, visible]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-auto z-10 transition-opacity duration-1000" style={{ mixBlendMode: 'screen' }}>
      <Canvas camera={{ position: [0, 0, 80], fov: 45 }} gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}>
        <ambientLight intensity={0.5} />
        <GraphLayer positions={positions} edges={edges} energies={energies} types={types} states={states} simParams={simulationParams} debugMode={debugMode} show4D={show4D} workerRef={workerRef} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} mipmapBlur intensity={debugMode ? 1.0 : 2.0} />
        </EffectComposer>
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} autoRotate autoRotateSpeed={simulationParams.spin * 2.0} maxDistance={200} minDistance={10} />
      </Canvas>
    </div>
  );
};

