import React, { useRef, useEffect, useState } from 'react';
import { Settings, Zap, Maximize2, RefreshCw, Activity, Eye, Cpu, Database, Wind, Star, Camera, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FourDPanel } from './FourDPanel';
import { RESEARCH_PRESETS, CATEGORY_COLORS, CATEGORY_LABELS, type BHPreset } from './presets';

// --- SHADERS ---

const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uMass;
  uniform float uSpin;
  uniform float uDiskIntensity;
  uniform float uDistance;
  uniform float uExposure;
  uniform float u4DOffset;
  uniform float uCoupling;
  uniform float uRayStep;
  uniform float uRayMaxDepth;
  uniform float uAberration;
  uniform float uCharge;
  uniform float uTDEPeak;
  uniform vec3 uLatentVector;
  uniform vec2 uCamRot;
  uniform vec3 uCamPos;
  uniform bool uOverclock;
  uniform bool uShowDisk;
  uniform bool uShowBackground;
  uniform bool uShowMatrix;
  uniform bool uShow4D;
  uniform bool uThermalMode;
  uniform float uFrameDrag;
  uniform float uDarkMatter;
  uniform int uModelType; // 0:Schwarz, 1:Kerr, 2:RN, 3:KN

  #define PI 3.14159265359

  // Procedural Starfield
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
                   mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
                   mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z);
  }

  vec3 getStarfield(vec3 dir) {
    vec3 color = vec3(0.0);
    
    // Latent space perturbation from AI Vector
    vec3 latentDir = dir + uLatentVector * 0.05;
    
    // Layered starfield for parallax and depth
    int starLayers = uOverclock ? 6 : 3;
    for(int i = 1; i <= 6; i++) {
        if (i > starLayers) break;
        float fi = float(i);
        float scale = fi * 15.0;
        vec3 p = latentDir * scale;
        
        // Luminosity and density variations
        float n = noise(p * 0.5 + fi * 10.0);
        float stars = pow(n, 12.0) * (2.0 / fi);
        
        // diverse star types (O-Type Blue to M-Type Red)
        float type = hash(p + fi * 1.5);
        vec3 starColor;
        if (type > 0.9) starColor = vec3(0.6, 0.7, 1.0); // O-Type
        else if (type > 0.7) starColor = vec3(1.0, 1.0, 1.0); // A-Type
        else if (type > 0.5) starColor = vec3(1.0, 1.0, 0.8); // G-Type
        else if (type > 0.3) starColor = vec3(1.0, 0.8, 0.6); // K-Type
        else starColor = vec3(1.0, 0.5, 0.4); // M-Type
        
        // Twinkle effect
        float twinkle = sin(uTime * (2.0 + type * 3.0) + type * 100.0) * 0.5 + 0.5;
        color += starColor * stars * (0.3 + 0.7 * twinkle);
    }
    
    return color;
  }

  // Simplified Gravitational Lensing
  // Based on Schwarzschild metric approximation
  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    uv.x *= uResolution.x / uResolution.y;

    // AI Neural perturbation of UV space based on latent embeddings
    uv += sin(uv * 10.0 + uLatentVector.xy * 2.0) * 0.005 * uLatentVector.z;

    // 4D Rotation / Projection with Coupling
    float w4d = sin(uTime * 0.1 + u4DOffset * uCoupling) * 0.5;
    
    vec3 camPos = uCamPos + vec3(0.0, w4d, 0.0);
    vec3 rayDir = normalize(vec3(uv, 1.2));

    // FPS-Style Camera Rotation (Pitch and Yaw)
    mat2 rotX = mat2(cos(uCamRot.x), sin(uCamRot.x), -sin(uCamRot.x), cos(uCamRot.x));
    mat2 rotY = mat2(cos(uCamRot.y), sin(uCamRot.y), -sin(uCamRot.y), cos(uCamRot.y));
    
    rayDir.zy *= rotX;
    rayDir.xz *= rotY;

    // Relativistic Aberration (NASA/ESA Goddard Model)
    // Simulates the contraction of the visual field as velocity increases
    if (uAberration > 0.0) {
        float speed = uAberration * 0.9;
        float cosTheta = rayDir.z;
        rayDir.z = (cosTheta + speed) / (1.0 + speed * cosTheta);
        float sinTheta = sqrt(max(0.0, 1.0 - rayDir.z * rayDir.z));
        float oldSinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
        if (oldSinTheta > 0.0001) {
            rayDir.xy *= (sinTheta / oldSinTheta);
        }
        rayDir = normalize(rayDir);
    }
    
    vec3 p = camPos;
    vec3 rd = rayDir;
    
    vec3 color = vec3(0.0);
    float diskAccum = 0.0;
    bool eventHorizon = false;

    float rs = uMass * 0.5; // Schwarzschild radius
    
    // Model specific metrics
    if (uModelType == 2 || uModelType == 3) {
        float q2 = uCharge * uCharge;
        rs = 0.5 * (uMass + sqrt(max(0.0, uMass * uMass - q2)));
    }
    float rsSquared = rs * rs;

    // OVERCLOCK: Hard increase of max steps with precision headroom
    int maxSteps = uOverclock ? 1800 : 700;

    // Simulation steps
    for(int i = 0; i < 2000; i++) {
      if (i >= maxSteps) break;
      if (float(i) >= uRayMaxDepth) break;
      
      float r2 = dot(p, p);
      float r = sqrt(r2);
      if (r < rs) { eventHorizon = true; break; }

      // Frame Dragging (Simulated Lense-Thirring effect)
      if (uFrameDrag > 0.0) {
          float draggingStrength = uFrameDrag * (rs / (r + 0.1));
          vec3 axis = vec3(0.0, 1.0, 0.0); // Spin axis
          rd = normalize(rd + cross(axis, p) * draggingStrength * 0.1);
      }

      // Gravitational deflection physics (Schwarzschild approximation)
      vec3 toCenter = -p / r;
      float deflection = (3.0 * rsSquared) / (r2 * r + 0.1); 
      rd = normalize(rd + toCenter * deflection);
      
      // GPU SUFFERING: Extreme Volumetric Integration Pass
      if (uOverclock) {
          float vNoise = noise(p * 2.0 + uTime * 0.5);
          diskAccum += vNoise * 0.05 * uDiskIntensity;
          // Sub-step loop for intensive shader complexity
          for(int j=0; j<8; j++) {
             rd = normalize(rd + noise(p * float(j+1)) * 0.001);
          }
      }

      p += rd * uRayStep * (r * 0.4); 

      // Accretion Disk intersection
      if (uShowDisk && abs(p.y) < 0.08 && r > rs * 2.5 && r < rs * 10.0) {
          float diskPos = (r - rs * 2.5) / (rs * 7.5);
          float brightness = exp(-diskPos * 5.0) * uDiskIntensity;
          
          // TDE Outflow / Peak Brightness (Image 2 Influence)
          brightness *= (1.0 + uTDEPeak * 50.0);
          
          float doppler = 1.0 + rd.x * uSpin;
          vec3 diskColor = mix(vec3(1.0, 0.2, 0.0), vec3(0.1, 0.4, 1.0), (doppler - 0.5));
          
          // TDE specific color shift (Bluer high-energy outflow)
          if (uTDEPeak > 0.0) {
              diskColor = mix(diskColor, vec3(0.4, 0.8, 1.0), uTDEPeak);
          }
          
          // Kerr-Newman Charge influence (Purple/Electronic jitter)
          if (uCharge > 0.0) {
              diskColor = mix(diskColor, vec3(0.6, 0.0, 1.0), uCharge * 0.5);
              diskAccum += sin(uTime * 10.0 + r) * uCharge * 0.1;
          }
          
          diskAccum += brightness;
          color += diskColor * brightness * 0.2;
      }
      
      if (r > 40.0) break;
    }

    if (!eventHorizon) {
      if (uShowBackground) {
        // Patch: Dark Matter Weak Lensing distortion
        vec3 distortedRd = rd;
        if (uDarkMatter > 0.0) {
            distortedRd += noise(rd * 10.0 + uTime * 0.1) * 0.02 * uDarkMatter;
            distortedRd = normalize(distortedRd);
        }
        color += getStarfield(distortedRd);
      }
    } else {
      color = vec3(0.0);
    }
    
    color += diskAccum * vec3(1.0, 0.6, 0.2);

    // Vector Dot Matrix Layer with Coupling and AI Latent influence
    if (uShowMatrix || uShow4D) {
      // Neural grid deformation across latent dimensions
      float couplingMode = uShow4D ? uCoupling * 2.0 : uCoupling;
      vec2 latentUV = vUv + sin(vUv * 20.0 + uLatentVector.xy) * 0.01 * uLatentVector.z;
      
      // If 4D mode, perturb grid with temporal dimension overlap
      if (uShow4D) {
          latentUV += noise(vec3(vUv * 5.0, uTime * 0.1)) * 0.05;
      }
      
      vec2 grid = fract(latentUV * uResolution / (16.0 / couplingMode));
      float dots = smoothstep(0.45, 0.5, grid.x) * smoothstep(0.45, 0.5, grid.y);
      float fieldIntensity = length(color);
      color *= (1.0 + dots * fieldIntensity * (2.0 * couplingMode + length(uLatentVector)));
    }

    // Tone mapping and Chromatic Aberration Post-Process
    vec3 outColor;
    if (uOverclock) {
        // GPU STRESS: Three-channel offset for chromatic aberration
        float rCol = 1.0 - exp(-(color.r * uExposure) * 1.0);
        float gCol = 1.0 - exp(-(color.g * uExposure) * 1.02);
        float bCol = 1.0 - exp(-(color.b * uExposure) * 1.05);
        outColor = vec3(rCol, gCol, bCol);
    } else {
        outColor = 1.0 - exp(-color * uExposure);
    }

    if (uThermalMode) {
        float intensity = length(outColor);
        vec3 cool = vec3(0.0, 0.0, 0.5);
        vec3 med = vec3(0.0, 1.0, 1.0);
        vec3 hot = vec3(1.0, 1.0, 0.0);
        vec3 ultra = vec3(1.0, 0.0, 0.0);
        
        if (intensity < 0.25) outColor = mix(cool, med, intensity * 4.0);
        else if (intensity < 0.5) outColor = mix(med, hot, (intensity - 0.25) * 4.0);
        else if (intensity < 0.75) outColor = mix(hot, ultra, (intensity - 0.5) * 4.0);
        else outColor = ultra;
    }

    gl_FragColor = vec4(outColor, 1.0);
  }
`;

// --- NEURAL BACKBONE VISUALIZER (Multi-Layer Perceptron: Image 8) ---
const NeuralNerveSystem = ({ nRef }: { nRef: any, meshData?: any }) => {
  const n = nRef.current;
  
  // Layer definitions [input, hidden1, hidden2, output]
  const layerCounts = [9, 12, 10, 1];
  
  return (
    <div className="relative h-64 w-full bg-black/40 rounded-xl border border-white/5 overflow-hidden p-4">
      <svg className="w-full h-full">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        
        {/* Connection Lines (Synapses) */}
        {layerCounts.slice(0, -1).map((currentCount, layerIdx) => (
          <g key={`layer-lines-${layerIdx}`}>
            {Array.from({ length: currentCount }).map((_, i) => (
              Array.from({ length: layerCounts[layerIdx + 1] }).map((_, j) => {
                const x1 = 15 + (layerIdx * (100 / (layerCounts.length - 1))) + "%";
                const y1 = 10 + (i * (80 / (currentCount - 1))) + "%";
                const x2 = 15 + ((layerIdx + 1) * (100 / (layerCounts.length - 1))) + "%";
                const y2 = 10 + (j * (80 / (layerCounts[layerIdx + 1] - 1))) + "%";
                
                // Weight visualization based on latent activity
                const weight = Math.sin(layerIdx * 10 + i * j + n.activity[i % 9] * 5);
                const isActive = weight > 0.8;
                
                return (
                  <motion.line
                    key={`line-${layerIdx}-${i}-${j}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={weight > 0 ? "#10b981" : "#ef4444"}
                    strokeOpacity={isActive ? 0.6 : 0.05}
                    strokeWidth={isActive ? 1.5 : 0.5}
                    initial={false}
                  />
                );
              })
            ))}
          </g>
        ))}

        {/* Nodes (Neurons) */}
        {layerCounts.map((count, layerIdx) => (
          <g key={`layer-nodes-${layerIdx}`}>
            {Array.from({ length: count }).map((_, i) => {
              const x = 15 + (layerIdx * (100 / (layerCounts.length - 1))) + "%";
              const y = 10 + (i * (80 / (count - 1))) + "%";
              const activity = n.activity[i % 9] || 0.1;
              
              return (
                <circle 
                  key={`node-${layerIdx}-${i}`}
                  cx={x} cy={y} r={3} 
                  fill={activity > 0.5 ? "#fb923c" : "#1e1e1e"}
                  stroke="#ffffff22"
                  strokeWidth="0.5"
                />
              );
            })}
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 left-4 flex gap-8 text-[7px] font-mono text-white/30 uppercase tracking-widest">
        <span>Input Layer</span>
        <span>Hidden [1]</span>
        <span>Hidden [2]</span>
        <span>Output</span>
      </div>
    </div>
  );
};

const starVertexShaderSource = `
  precision highp float;
  attribute vec3 aOrbit; // radius, phase, speed
  attribute vec3 aParams; // mass, spectralType, eccentricity
  varying vec3 vColor;
  varying float vPath;
  uniform float uTime;
  uniform float uMass;
  uniform vec2 uResolution;
  uniform vec2 uCamRot;
  uniform vec3 uCamPos;

  void main() {
    float r = aOrbit.x;
    float phase = aOrbit.y;
    float speed = aOrbit.x * 0.1 + aOrbit.z;
    float t = uTime * speed;
    
    // Independent physics: Orbital mechanics with eccentricity
    float angle = phase + t;
    float ecc = aParams.z;
    float r_ecc = r * (1.0 - ecc * ecc) / (1.0 + ecc * cos(angle));
    
    vec3 p = vec3(r_ecc * cos(angle), sin(angle * 0.5) * aParams.x * 0.1, r_ecc * sin(angle));
    
    // Project to camera
    vec3 cp = p - uCamPos;
    
    // Apply camera rotation
    mat2 rotX = mat2(cos(uCamRot.x), sin(uCamRot.x), -sin(uCamRot.x), cos(uCamRot.x));
    mat2 rotY = mat2(cos(uCamRot.y), sin(uCamRot.y), -sin(uCamRot.y), cos(uCamRot.y));
    cp.zy *= rotX;
    cp.xz *= rotY;
    
    // Gravitational Lensing for every single star
    // Simplified Einstein ring deflection
    float distSq = dot(cp.xy, cp.xy);
    float rs = uMass * 0.5;
    if (distSq > 0.001) {
        float deflection = (4.0 * rs) / sqrt(distSq + cp.z * cp.z);
        cp.xy += cp.xy * deflection * (1.0 / cp.z);
    }

    // Perspective Projection
    float fieldOfView = 1.2;
    gl_Position = vec4(cp.xy * fieldOfView, 0.0, cp.z);
    gl_PointSize = (2.0 / cp.z) * (40.0 * aParams.y);
    
    // Spectral color
    if (aParams.y > 0.8) vColor = vec3(0.6, 0.8, 1.0);
    else if (aParams.y > 0.5) vColor = vec3(1.0, 1.0, 1.0);
    else vColor = vec3(1.0, 0.6, 0.3);

    // Cyan Trail override (Reference Image influence)
    vPath = 0.0;
    if (mod(aOrbit.y * 137.0, 50.0) < 1.0) {
        vColor = vec3(0.0, 0.9, 1.0);
        vPath = 1.0;
        gl_PointSize *= 2.0;
    }
    
    // Fade based on distance
    vColor *= clamp(1.0 - cp.z * 0.05, 0.0, 1.0);
  }
`;

const starFragmentShaderSource = `
  precision highp float;
  varying vec3 vColor;
  varying float vPath;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float glow = exp(-d * 8.0) * (vPath > 0.5 ? 2.5 : 1.0);
    gl_FragColor = vec4(vColor * glow, (0.5 - d) * 2.0);
  }
`;

const BlackHoleCanvas = ({ 
  mass, spin, diskIntensity, distance, exposure, offset4D, 
  coupling, rayStepSize, rayMaxDepth, aberration, highPower, 
  overclock, charge, tdePeak, latentVector, camRot, camPos, 
  showDisk, showBackground, showMatrix, neuralRef, starCount, 
  timeScale, thermalMode, frameDrag, darkMatter, modelType, show4D 
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const starProgramRef = useRef<WebGLProgram | null>(null);
  const accumulatedTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const workersRef = useRef<Worker[]>([]);
  const buffersRef = useRef<any>({});
  
  // Store dynamic parameters in a ref to be accessed by the render loop without re-triggering effects
  const paramsRef = useRef({
    mass, spin, diskIntensity, distance, exposure, offset4D, coupling, 
    rayStepSize, rayMaxDepth, aberration, highPower, overclock, 
    charge, tdePeak, latentVector, camRot, camPos, showDisk, 
    showBackground, showMatrix, starCount, timeScale, thermalMode, 
    frameDrag, darkMatter, modelType, show4D
  });

  useEffect(() => {
    paramsRef.current = {
      mass, spin, diskIntensity, distance, exposure, offset4D, coupling, 
      rayStepSize, rayMaxDepth, aberration, highPower, overclock, 
      charge, tdePeak, latentVector, camRot, camPos, showDisk, 
      showBackground, showMatrix, starCount, timeScale, thermalMode, 
      frameDrag, darkMatter, modelType, show4D
    };
  }, [
    mass, spin, diskIntensity, distance, exposure, offset4D, coupling, 
    rayStepSize, rayMaxDepth, aberration, highPower, overclock, 
    charge, tdePeak, latentVector, camRot, camPos, showDisk, 
    showBackground, showMatrix, starCount, timeScale, thermalMode, 
    frameDrag, darkMatter, modelType, show4D
  ]);
  
  const MAX_STARS = 10000000;

  // --- INITIALIZATION PASS (ONE TIME) ---
  useEffect(() => {
    const canvas = canvasRef.current!;
    const gl = canvas.getContext('webgl', { 
        antialias: false, 
        powerPreference: "high-performance",
        preserveDrawingBuffer: false
    });
    if (!gl) {
      console.error('WebGL context unavailable — simulation disabled.');
      return;
    }
    glRef.current = gl;

    const setupWorkers = () => {
      workersRef.current.forEach(w => w.terminate());
      if (paramsRef.current.overclock) {
        workersRef.current = Array.from({ length: 4 }, () => new Worker(new URL('./physicsWorker.ts', import.meta.url)));
        workersRef.current.forEach(w => w.postMessage({ mode: 'START', iterations: 1000 }));
      }
    };
    setupWorkers();

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const program = gl.createProgram()!;
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (vs && fs) {
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        programRef.current = program;
    }

    const svs = createShader(gl, gl.VERTEX_SHADER, starVertexShaderSource);
    const sfs = createShader(gl, gl.FRAGMENT_SHADER, starFragmentShaderSource);
    if (svs && sfs) {
        const starProgram = gl.createProgram()!;
        gl.attachShader(starProgram, svs);
        gl.attachShader(starProgram, sfs);
        gl.linkProgram(starProgram);
        starProgramRef.current = starProgram;
    }

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    buffersRef.current.quad = quadBuffer;

    const starOrbitData = new Float32Array(MAX_STARS * 3);
    const starParamsData = new Float32Array(MAX_STARS * 3);
    for(let i=0; i<MAX_STARS; i++) {
        starOrbitData[i*3] = 4.0 + Math.pow(Math.random(), 1.5) * 600.0;
        starOrbitData[i*3+1] = Math.random() * Math.PI * 2.0;
        starOrbitData[i*3+2] = (0.05 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1);
        starParamsData[i*3] = Math.random() * 20.0;
        starParamsData[i*3+1] = 0.1 + Math.random() * 0.9;
        starParamsData[i*3+2] = Math.random() * 0.8;
    }
    
    const orbitBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, orbitBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, starOrbitData, gl.STATIC_DRAW);
    buffersRef.current.orbit = orbitBuffer;
    
    const paramsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, paramsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, starParamsData, gl.STATIC_DRAW);
    buffersRef.current.params = paramsBuffer;

    // Resizing logic with ResizeObserver
    const handleResize = (entries: ResizeObserverEntry[]) => {
      if (!entries[0] || !canvas) return;
      const { width, height } = entries[0].contentRect;
      const multiplier = (paramsRef.current.highPower ? 2.0 : 1.0) * (paramsRef.current.overclock ? 1.5 : 1.0);
      const dpr = (window.devicePixelRatio || 1) * multiplier;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // Render loop
    let animationFrame: number;
    const render = () => {
      const gl = glRef.current;
      const program = programRef.current;
      const starProgram = starProgramRef.current;
      if (!gl || !canvas || !program || !starProgram) return;

      const p = paramsRef.current;
      const now = Date.now();
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      accumulatedTimeRef.current += delta * p.timeScale;
      
      const time = accumulatedTimeRef.current;
      const nState = neuralRef.current.state;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // --- PASS 1: Black Hole Simulation ---
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.quad);
      const positionLoc = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      const modMass = p.mass * (nState[0] / 10.0);
      const modSpin = p.spin * (nState[1] / 0.8);
      const modDist = p.distance * (nState[3] / 50.0);

      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);
      gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(program, 'uMass'), modMass);
      gl.uniform1f(gl.getUniformLocation(program, 'uSpin'), modSpin);
      gl.uniform1f(gl.getUniformLocation(program, 'uDistance'), modDist);
      gl.uniform1f(gl.getUniformLocation(program, 'uExposure'), p.exposure);
      gl.uniform1f(gl.getUniformLocation(program, 'u4DOffset'), p.offset4D);
      gl.uniform1f(gl.getUniformLocation(program, 'uCoupling'), p.coupling * (nState[4]/10.0));
      gl.uniform1f(gl.getUniformLocation(program, 'uRayStep'), p.rayStepSize);
      gl.uniform1f(gl.getUniformLocation(program, 'uRayMaxDepth'), p.rayMaxDepth);
      gl.uniform1f(gl.getUniformLocation(program, 'uAberration'), p.aberration * (nState[5]/0.5));
      gl.uniform1f(gl.getUniformLocation(program, 'uCharge'), p.charge);
      gl.uniform1f(gl.getUniformLocation(program, 'uTDEPeak'), p.tdePeak);
      gl.uniform3f(gl.getUniformLocation(program, 'uLatentVector'), 
        p.latentVector.x + nState[6], 
        p.latentVector.y + nState[7], 
        p.latentVector.z + nState[8]
      );
      gl.uniform2f(gl.getUniformLocation(program, 'uCamRot'), p.camRot.x, p.camRot.y);
      gl.uniform3f(gl.getUniformLocation(program, 'uCamPos'), p.camPos.x, p.camPos.y, p.camPos.z);
      gl.uniform1i(gl.getUniformLocation(program, 'uOverclock'), p.overclock ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(program, 'uDiskIntensity'), p.diskIntensity * (nState[2]/10.0));
      gl.uniform1i(gl.getUniformLocation(program, 'uShowDisk'), p.showDisk ? 1 : 0);
      gl.uniform1i(gl.getUniformLocation(program, 'uShowBackground'), p.showBackground ? 1 : 0);
      gl.uniform1i(gl.getUniformLocation(program, 'uShowMatrix'), p.showMatrix ? 1 : 0);
      gl.uniform1i(gl.getUniformLocation(program, 'uShow4D'), p.show4D ? 1 : 0);
      gl.uniform1i(gl.getUniformLocation(program, 'uThermalMode'), p.thermalMode ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(program, 'uFrameDrag'), p.frameDrag);
      gl.uniform1f(gl.getUniformLocation(program, 'uDarkMatter'), p.darkMatter);
      gl.uniform1i(gl.getUniformLocation(program, 'uModelType'), p.modelType);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // --- PASS 2: Stars ---
      if (p.showBackground) {
        gl.useProgram(starProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.orbit);
        const aOrbit = gl.getAttribLocation(starProgram, 'aOrbit');
        gl.enableVertexAttribArray(aOrbit);
        gl.vertexAttribPointer(aOrbit, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersRef.current.params);
        const aParams = gl.getAttribLocation(starProgram, 'aParams');
        gl.enableVertexAttribArray(aParams);
        gl.vertexAttribPointer(aParams, 3, gl.FLOAT, false, 0, 0);

        gl.uniform1f(gl.getUniformLocation(starProgram, 'uTime'), time);
        gl.uniform1f(gl.getUniformLocation(starProgram, 'uMass'), modMass);
        gl.uniform2f(gl.getUniformLocation(starProgram, 'uResolution'), canvas.width, canvas.height);
        gl.uniform2f(gl.getUniformLocation(starProgram, 'uCamRot'), p.camRot.x, p.camRot.y);
        gl.uniform3f(gl.getUniformLocation(starProgram, 'uCamPos'), p.camPos.x, p.camPos.y, p.camPos.z);
        
        gl.drawArrays(gl.POINTS, 0, p.starCount);
      }
      
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
        workersRef.current.forEach(w => w.terminate());
        resizeObserver.disconnect();
        cancelAnimationFrame(animationFrame);
        gl.deleteBuffer(quadBuffer);
        gl.deleteBuffer(orbitBuffer);
        gl.deleteBuffer(paramsBuffer);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative">
        <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
        style={{ background: '#000' }}
        />
    </div>
  );
};

// --- 3D MESH DEBUG VISUALIZER ---
const MeshDebug3D = ({ nRef, meshData }: { nRef: any; meshData: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef({ x: -0.35, y: 0.4, dragging: false, lx: 0, ly: 0 });
  const animRef = useRef<number>(0);
  const layerCounts = [9, 12, 10, 1];
  const LAYER_Z = 2.2;
  const NODE_Y = 0.75;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes3D = layerCounts.flatMap((count, li) =>
      Array.from({ length: count }, (_, ni) => ({
        x: (li - (layerCounts.length - 1) / 2) * LAYER_Z,
        y: (ni - (count - 1) / 2) * NODE_Y,
        z: 0,
        li,
        ni,
      }))
    );

    const project = (x: number, y: number, z: number, rx: number, ry: number, cw: number, ch: number) => {
      const cy = Math.cos(ry), sy = Math.sin(ry);
      const x1 = x * cy - z * sy;
      const z1 = x * sy + z * cy;
      const cx2 = Math.cos(rx), sx2 = Math.sin(rx);
      const y1 = y * cx2 - z1 * sx2;
      const z2 = y * sx2 + z1 * cx2;
      const fov = 260;
      const d = z2 + 9;
      return { px: (x1 * fov) / d + cw / 2, py: (y1 * fov) / d + ch / 2, depth: z2 };
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    const draw = () => {
      const rot = rotRef.current;
      if (!rot.dragging) rot.y += 0.007;

      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      const n = nRef.current;
      const md = meshData.current;

      const proj = nodes3D.map(node => ({
        ...node,
        ...project(node.x, node.y, node.z, rot.x, rot.y, W, H),
      }));

      const layerLabels = ['INPUT', 'HIDDEN-1', 'HIDDEN-2', 'OUTPUT'];
      const layerColors = ['#06b6d4', '#10b981', '#a78bfa', '#f97316'];

      layerCounts.slice(0, -1).forEach((cc, li) => {
        const cur = proj.filter(p => p.li === li);
        const nxt = proj.filter(p => p.li === li + 1);
        cur.forEach(cp => {
          nxt.forEach(np => {
            const w = Math.sin(li * 7 + cp.ni * np.ni + 1.3);
            const act = (n.activity[cp.ni % 9] || 0) as number;
            const isAct = w > 0.6 || act > 0.5;
            ctx.beginPath();
            ctx.moveTo(cp.px, cp.py);
            ctx.lineTo(np.px, np.py);
            ctx.strokeStyle = isAct
              ? `rgba(16,185,129,${isAct ? 0.35 : 0.04})`
              : `rgba(239,68,68,${Math.max(0.02, Math.abs(w) * 0.1)})`;
            ctx.lineWidth = isAct ? 0.7 : 0.25;
            ctx.stroke();
          });
        });
        for (let i = 0; i < cc - 1; i++) {
          const a = proj.find(p => p.li === li && p.ni === i);
          const b = proj.find(p => p.li === li && p.ni === i + 1);
          if (a && b) {
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.strokeStyle = `rgba(255,255,255,0.04)`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      });
      for (let i = 0; i < layerCounts[layerCounts.length - 1] - 1; i++) {
        const a = proj.find(p => p.li === layerCounts.length - 1 && p.ni === i);
        const b = proj.find(p => p.li === layerCounts.length - 1 && p.ni === i + 1);
        if (a && b) {
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.strokeStyle = `rgba(255,255,255,0.04)`;
          ctx.lineWidth = 0.4;
          ctx.stroke();
        }
      }

      const sorted = [...proj].sort((a, b) => b.depth - a.depth);
      sorted.forEach(node => {
        const act = (n.activity[node.ni % 9] || 0) as number;
        const rawMesh = md?.nodes ? md.nodes[node.ni * 20] : 0;
        const meshVal = isNaN(rawMesh) ? 0 : rawMesh;
        const simState = (n.state[node.ni % 9] || 0) as number;
        const isAct = act > 0.5 || meshVal > 0.5;
        const r = Math.max(2, 4.5 - node.depth * 0.15);
        const col = layerColors[node.li];

        if (isAct) {
          const grd = ctx.createRadialGradient(node.px, node.py, 0, node.px, node.py, r * 4);
          grd.addColorStop(0, col.replace(')', ',0.4)').replace('rgb', 'rgba'));
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(node.px, node.py, r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.px, node.py, r, 0, Math.PI * 2);
        ctx.fillStyle = isAct ? col : 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = isAct ? col + '88' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (r > 3) {
          ctx.fillStyle = `rgba(255,255,255,${isAct ? 0.65 : 0.2})`;
          ctx.font = '6px monospace';
          ctx.fillText(meshVal.toFixed(2), node.px + r + 2, node.py + 2);
          ctx.fillStyle = `rgba(255,255,255,0.12)`;
          ctx.fillText(`s:${simState.toFixed(1)}`, node.px + r + 2, node.py + 9);
        }
      });

      layerCounts.forEach((_, li) => {
        const ln = proj.filter(p => p.li === li);
        if (!ln.length) return;
        const ax = ln.reduce((s, p) => s + p.px, 0) / ln.length;
        const my = Math.min(...ln.map(p => p.py));
        ctx.fillStyle = layerColors[li] + '99';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(layerLabels[li], ax, my - 10);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '6px monospace';
        ctx.fillText(`N=${layerCounts[li]}`, ax, my - 3);
        ctx.textAlign = 'left';
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    const onDown = (e: MouseEvent) => {
      rotRef.current.dragging = true;
      rotRef.current.lx = e.clientX;
      rotRef.current.ly = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!rotRef.current.dragging) return;
      rotRef.current.y += (e.clientX - rotRef.current.lx) * 0.012;
      rotRef.current.x += (e.clientY - rotRef.current.ly) * 0.012;
      rotRef.current.lx = e.clientX;
      rotRef.current.ly = e.clientY;
    };
    const onUp = () => { rotRef.current.dragging = false; };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div className="relative w-full bg-black/60 rounded-xl border border-white/5 overflow-hidden" style={{ height: 288 }}>
      <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" style={{ display: 'block' }} />
      <div className="absolute top-2 left-3 text-[7px] font-mono text-white/30 uppercase tracking-widest pointer-events-none">
        3D Mesh Debug · Drag to Rotate
      </div>
      <div className="absolute bottom-2 left-3 flex gap-4 pointer-events-none">
        {[['#06b6d4', 'Input'], ['#10b981', 'Hidden-1'], ['#a78bfa', 'Hidden-2'], ['#f97316', 'Output']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1 text-[6px] font-mono text-white/30">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
      <div className="absolute top-2 right-3 text-[6px] font-mono text-white/20 uppercase pointer-events-none">
        Node values: mesh · s: sim-state
      </div>
    </div>
  );
};

// --- QUANTUM MATH OVERLAY (Scientific PDF Formulas) ---
const MathMatrixOverlay = () => {
  return (
    <div className="space-y-4 font-mono text-[9px] text-orange-400/80 uppercase">
      <div className="border-l-2 border-orange-500/50 pl-3 py-2 space-y-2">
        <p className="text-orange-500 font-bold">Kerr-Newman Metric (Eq 4):</p>
        <p className="text-[10px] lowercase tracking-normal font-sans">ds² = -(1 - (2Mr-Q²)/ρ²)dt² + (ρ²/Δ)dr² + ρ²dθ²</p>
        <p className="text-[10px] lowercase tracking-normal font-sans">+ [(r²+a²)sin²θ + (2Mr-Q²)a²sin⁴θ/ρ²]dφ²</p>
        <p className="text-[7px] text-white/40 lowercase font-sans font-light">ρ² = r² + a²cos²θ | Δ = r² - 2Mr + a² + Q²</p>
      </div>
      <div className="border-l-2 border-emerald-500/30 pl-3 py-2 space-y-2">
        <p className="text-emerald-400/60 font-bold">Density Relationship (Eq 5):</p>
        <p className="text-[10px] lowercase tracking-normal font-sans">r_g = 2GM / c²</p>
        <p className="text-[10px] lowercase tracking-normal font-sans">ρ = M / (4/3 π r³)</p>
        <p className="text-[10px] lowercase tracking-normal font-sans">ρ = 3c⁶ / (32π G³ M²)</p>
      </div>
      <div className="border-l-2 border-white/5 pl-3 py-2 opacity-30 italic font-sans normal-case">
        <p>"Black holes are products of the death of stars."</p>
        <p className="not-italic text-[7px] text-white/50 tracking-widest mt-1 uppercase">— PSETE Research Paper 2024</p>
      </div>
    </div>
  );
};

const layerCountsForDebug = [9, 12, 10, 1];
const SYSTEM_PRECISION_BOOST = 1000;

export default function App() {
  const [mass, setMass] = useState(10.0);
  const [spin, setSpin] = useState(0.8);
  const [diskIntensity, setDiskIntensity] = useState(10.0);
  const [distance, setDistance] = useState(50.0);
  const [exposure, setExposure] = useState(2.0);
  const [offset4D, setOffset4D] = useState(0.0);
  const [coupling, setCoupling] = useState(10.0);
  const [rayStepSize, setRayStepSize] = useState(0.1);
  const [rayMaxDepth, setRayMaxDepth] = useState(1400);
  const [aberration, setAberration] = useState(0.5);
  const [highPower, setHighPower] = useState(false);
  const [overclock, setOverclock] = useState(false);
  const [latentVector, setLatentVector] = useState({ x: 0.1, y: -0.2, z: 0.5 });
  const [camRot, setCamRot] = useState({ x: 0, y: 0 });
  const [camPos, setCamPos] = useState({ x: 0, y: 0, z: -5.0 });
  const [showDisk, setShowDisk] = useState(true);
  const [showBackground, setShowBackground] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);
  const [thermalMode, setThermalMode] = useState(false);
  const [frameDrag, setFrameDrag] = useState(0.5);
  const [darkMatter, setDarkMatter] = useState(0.3);
  const [modelType, setModelType] = useState(1); // 1: Kerr
  const [show4D, setShow4D] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [starCount, setStarCount] = useState(500000);
  const [charge, setCharge] = useState(0.0);
  const [activeTab, setActiveTab] = useState<'physics' | 'optics' | 'engine' | 'neural' | 'research'>('physics');
  const [datView, setDatView] = useState<'net' | 'mesh'>('net');
  
  // Speed Modulation States
  const [timeScale, setTimeScale] = useState(1.0);
  const [moveScale, setMoveScale] = useState(1.0);

  // New Pathway States
  const [pathway, setPathway] = useState<'standard' | 'galactic' | 'tde'>('standard');
  const [gasFraction, setGasFraction] = useState(60.0);
  const [agnPower, setAgnPower] = useState(0.2);
  const [tdePeak, setTdePeak] = useState(0.0);
  const [isTDEActive, setIsTDEActive] = useState(false);

  // --- 4D WINDOW ---
  const [show4DWindow, setShow4DWindow] = useState(false);

  // --- ADVANCED PHYSICS PARAMETERS (research-grade precision) ---
  // Accretion disc physics (DST/TDE papers)
  const [eddingtonRatio, setEddingtonRatio] = useState(0.1);        // λ = L/L_Edd
  const [diskViscosity, setDiskViscosity] = useState(0.12);          // α-viscosity (Shakura-Sunyaev)
  const [diskAspectRatio, setDiskAspectRatio] = useState(0.05);      // H/R disk thickness
  const [massOutflowRate, setMassOutflowRate] = useState(0.05);      // fraction of infalling mass ejected
  const [impactParameter, setImpactParameter] = useState(1.0);       // β tidal disruption impact
  const [windVelocity, setWindVelocity] = useState(0.05);            // disk wind speed (fraction of c)

  // Relativistic jet (AGN/radio-mode papers)
  const [jetLorentzFactor, setJetLorentzFactor] = useState(1.0);     // bulk Lorentz factor Γ
  const [jetOpeningAngle, setJetOpeningAngle] = useState(5.0);       // half-opening angle (deg)
  const [agnFeedbackEff, setAgnFeedbackEff] = useState(0.0);         // mechanical feedback efficiency ε

  // Host galaxy / galactic environment (Nature/M-sigma papers)
  const [stellarDispersion, setStellarDispersion] = useState(100.0); // σ stellar velocity (km/s)
  const [mSigmaAlpha, setMSigmaAlpha] = useState(4.24);              // M-σ power law index
  const [hotHaloTemp, setHotHaloTemp] = useState(5e7);               // hot gas halo temperature (K)
  const [darkMatterConc, setDarkMatterConc] = useState(10.0);        // NFW concentration parameter

  // Binary merger / gravitational waves (LIGO/Caltech papers)
  const [massRatio, setMassRatio] = useState(1.0);                   // q = M₂/M₁ ≤ 1
  const [chirpMass, setChirpMass] = useState(28.3);                  // chirp mass (M☉)
  const [orbitalEcc, setOrbitalEcc] = useState(0.0);                 // orbital eccentricity
  const [finalMergerSpin, setFinalMergerSpin] = useState(0.67);      // Bowen-York final spin

  // S-star orbits (Keck/UCLA/GRAVITY papers)
  const [s2OrbitalPeriod] = useState(16.0455);                       // S2 period (years) — fixed
  const [s2Eccentricity, setS2Eccentricity] = useState(0.8843);      // S2 eccentricity (GRAVITY 2018)

  // Active preset tracking
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Advanced section toggle
  const [showAdvancedPhysics, setShowAdvancedPhysics] = useState(false);

  // Load preset function
  const loadPreset = (preset: BHPreset) => {
    setMass(preset.mass);
    setSpin(preset.spin);
    setCharge(preset.charge);
    setDistance(preset.distance);
    setDiskIntensity(preset.diskIntensity);
    setExposure(preset.exposure);
    setFrameDrag(preset.frameDrag);
    setDarkMatter(preset.darkMatter);
    setModelType(preset.modelType);
    setAberration(preset.aberration);
    setCoupling(preset.coupling);
    setRayMaxDepth(Math.min(2000, preset.rayMaxDepth + SYSTEM_PRECISION_BOOST));
    setEddingtonRatio(preset.eddingtonRatio);
    setDiskViscosity(preset.diskViscosity);
    setJetLorentzFactor(preset.jetLorentzFactor);
    setStellarDispersion(preset.stellarDispersion);
    setImpactParameter(preset.impactParameter);
    setDiskAspectRatio(preset.diskAspectRatio);
    setMassOutflowRate(preset.massOutflowRate);
    setAgnFeedbackEff(preset.agnFeedbackEff);
    setMassRatio(preset.massRatio);
    setChirpMass(preset.chirpMass);
    setOrbitalEcc(preset.orbitalEcc);
    setS2Eccentricity(preset.orbitalEcc > 0 ? preset.orbitalEcc : s2Eccentricity);
    setDarkMatterConc(preset.darkMatterConc);
    setMSigmaAlpha(preset.mSigmaAlpha > 0 ? preset.mSigmaAlpha : mSigmaAlpha);
    setActivePreset(preset.shortName);
    if (preset.category === 'tde') setPathway('tde');
    else if (preset.category === 'galactic' || preset.category === 'agn') setPathway('galactic');
    else setPathway('standard');
  };

  // Classification Logic from PDF
  const getClassification = (m: number) => {
    if (m < 5.0) return { type: "SBH", desc: "Stellar-Mass" };
    if (m < 15.0) return { type: "IMBH", desc: "Intermediate-Mass" };
    return { type: "MBH", desc: "Supermassive (Gargantua Class)" };
  };
  const bhClass = getClassification(mass);

  // --- SYSTEM LOAD BALANCER ---
  const ramBuffer = useRef<Float32Array | null>(null);
  const neuralWorkers = useRef<Worker[]>([]);
  const meshData = useRef({
    nodes: new Float32Array(2048).map(() => Math.random()),
    weights: new Float32Array(2048 * 2048).map(() => Math.random() * 0.2 - 0.1),
    activity: 0
  });

  const touchState = useRef({ isTouching: false, lastTouch: { x: 0, y: 0 } });

  useEffect(() => {
    // Stress tests only active when Overclocked
    if (!overclock) {
       ramBuffer.current = null;
       neuralWorkers.current.forEach(w => w.terminate());
       neuralWorkers.current = [];
       return;
    }

    // pillars of weight 1: RAM STRESS (Active only on Overclock)
    const bufferSize = 1024 * 1024 * (show4DWindow ? 48 : 64); // Adaptive RAM pressure (192MB / 256MB)
    ramBuffer.current = new Float32Array(bufferSize);
    
    const ramInterval = setInterval(() => {
      const buf = ramBuffer.current;
      if (!buf) return;
      for (let i = 0; i < 50000; i++) {
        const idx = Math.floor(Math.random() * bufferSize);
        buf[idx] = Math.random();
      }
    }, 32); // Lower frequency for stability

    // pillars of weight 2: CPU STRESS (Neural Mesh)
    const workerCount = show4DWindow ? 2 : 4;
    const workers = Array.from({ length: workerCount }, () => new Worker(new URL('./neuralWorker.ts', import.meta.url)));
    
    workers.forEach(w => {
      w.onmessage = (e) => {
        meshData.current.nodes = e.data.nodes;
        meshData.current.activity = e.data.activity;
        // Controlled re-queue
        setTimeout(() => {
           if(neuralWorkers.current.includes(w)) {
              w.postMessage({
                mode: 'NEURAL_TICK',
                nodes: meshData.current.nodes,
                weights: meshData.current.weights
              });
           }
        }, 32); 
      };
      w.postMessage({
        mode: 'NEURAL_TICK',
        nodes: meshData.current.nodes,
        weights: meshData.current.weights
      });
    });
    neuralWorkers.current = workers;

    return () => {
      clearInterval(ramInterval);
      workers.forEach(w => w.terminate());
    };
  }, [overclock, show4DWindow]);

  // --- NEURAL MESH BACKBONE (Legacy Sync for UI) ---
  const neuralRef = useRef({
    state: [10, 0.8, 10, 50, 10, 0.5, 0.1, 0.1, 0.1], // Mass, Spin, Disk, Dist, Coupling, Aberration, LatentX, LatentY, LatentZ
    activity: new Float32Array(9)
  });

  // Neural propagation loop (Legacy UI bridge)
  useEffect(() => {
    const propagate = setInterval(() => {
      const n = neuralRef.current;
      const nodes = meshData.current.nodes;
      
      // Bridge the high-node mesh back to the 9 primary simulation controllers
      for (let i = 0; i < 9; i++) {
        n.state[i] = nodes[i * 20] * (i < 5 ? 100 : 1); // Scale for heavy metrics
        n.activity[i] = meshData.current.activity;
      }
      
      (window as any).__neuralActivity = meshData.current.activity;
    }, 16);
    return () => clearInterval(propagate);
  }, []);

  const schRadius = (mass * 2.95).toFixed(2);

  const takeScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `blackhole-capture-${Date.now()}.png`;
    link.href = url;
    link.click();
  };

  const triggerTDE = () => {
    if (isTDEActive) return;
    setIsTDEActive(true);
    let start = Date.now();
    const duration = 5000;
    
    const animateTDE = () => {
      const elapsed = Date.now() - start;
      const progress = elapsed / duration;
      
      if (progress < 0.2) {
        setTdePeak(progress * 5); // Rapid rise
      } else {
        setTdePeak(Math.max(0, 1 - (progress - 0.2) * 1.25)); // Slower decay
      }
      
      if (progress < 1) requestAnimationFrame(animateTDE);
      else {
        setIsTDEActive(false);
        setTdePeak(0);
      }
    };
    requestAnimationFrame(animateTDE);
  };

  const loadS2Preset = () => {
    setPathway('standard');
    setMass(42.0); // 4.2 million solar masses simplified
    setSpin(0.9);
    setDistance(200.0);
    setStarCount(1000000);
    setExposure(1.5);
    setDiskIntensity(5.0);
  };

  // Hyper-Responsive Movement Tick (125Hz Polling)
  useEffect(() => {
    const moveTick = setInterval(() => {
        // Overclocked movement response: hold screen to move forward in look direction
        if(!touchState.current.isTouching) return;
        
        const speed = 0.5 * (overclock ? 3.0 : 1.0) * moveScale;
        const forward = { x: Math.sin(camRot.y), z: Math.cos(camRot.y) };

        setCamPos(prev => ({
            x: prev.x + forward.x * speed,
            y: prev.y,
            z: prev.z + forward.z * speed
        }));
    }, 8); // 8ms = ~125Hz for immediate response
    return () => clearInterval(moveTick);
  }, [camRot, overclock, moveScale]);

  return (
    <div 
      className="relative w-full h-screen bg-[#050505] text-[#e0e0e0] overflow-hidden font-sans flex flex-col touch-none"
      onTouchStart={(e) => {
        const touch = e.touches[0];
        touchState.current.lastTouch = { x: touch.clientX, y: touch.clientY };
        touchState.current.isTouching = true;
      }}
      onTouchEnd={() => {
        touchState.current.isTouching = false;
      }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        const last = touchState.current.lastTouch;
        if (last) {
          const dx = touch.clientX - last.x;
          const dy = touch.clientY - last.y;
          // Overclocked rotation sensitivity
          const sensitivity = overclock ? 0.015 : 0.008;
          setCamRot(prev => ({
            x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.x - dy * sensitivity)),
            y: prev.y - dx * sensitivity
          }));
          touchState.current.lastTouch = { x: touch.clientX, y: touch.clientY };
        }
      }}
      onMouseDown={(e) => {
        touchState.current.lastTouch = { x: e.clientX, y: e.clientY };
        touchState.current.isTouching = true;
      }}
      onMouseUp={() => {
        touchState.current.isTouching = false;
      }}
      onMouseLeave={() => {
        touchState.current.isTouching = false;
      }}
      onMouseMove={(e) => {
        if (!touchState.current.isTouching) return;
        const last = touchState.current.lastTouch;
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        const sensitivity = overclock ? 0.015 : 0.008;
        setCamRot(prev => ({
          x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.x - dy * sensitivity)),
          y: prev.y - dx * sensitivity
        }));
        touchState.current.lastTouch = { x: e.clientX, y: e.clientY };
      }}
    >
      {/* Simulation Layer */}
      <div className="absolute inset-0 z-0">
        <BlackHoleCanvas 
          mass={mass} 
          spin={spin} 
          diskIntensity={diskIntensity}
          distance={distance}
          exposure={exposure}
          offset4D={offset4D}
          coupling={coupling}
          rayStepSize={rayStepSize}
          rayMaxDepth={rayMaxDepth}
          aberration={aberration}
          highPower={highPower}
          overclock={overclock}
          charge={charge}
          tdePeak={tdePeak}
          latentVector={latentVector}
          camRot={camRot}
          camPos={camPos}
          showDisk={showDisk}
          showBackground={showBackground}
          showMatrix={showMatrix}
          neuralRef={neuralRef}
          starCount={starCount}
          timeScale={timeScale}
          thermalMode={thermalMode}
          frameDrag={frameDrag}
          darkMatter={darkMatter}
          modelType={modelType}
          show4D={show4D}
        />
      </div>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 z-20 border-b border-white/5 bg-black/40 backdrop-blur-sm pointer-events-auto">
        <div className="flex items-center gap-4">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
          <h1 className="text-[10px] font-mono tracking-[0.4em] uppercase text-white/70">Singularity v4.1 // Real-Time Kerr Metric Simulator</h1>
        </div>
        <div className="flex gap-8 text-[10px] font-mono uppercase opacity-50 hidden md:flex">
          <span className={overclock ? 'text-red-400' : ''}>CPU: {overclock ? '4-Core Fabric' : 'Integrated Logic'}</span>
          <span className={overclock ? 'text-red-400' : ''}>RAM: {overclock ? '512MB Buffer' : 'Nominal'}</span>
          <span>VRAM: {starCount.toLocaleString()} Stars</span>
          <span>GPU: {rayMaxDepth}-Depth Metric</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShow4DWindow(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${show4DWindow ? 'bg-purple-600/30 border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]' : 'bg-white/5 border-white/10 text-white/50 hover:text-purple-300 hover:border-purple-500/30'}`}
          >
            <Box size={12} />
            4D Space
          </button>
          <button 
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.error(err));
              } else {
                document.exitFullscreen();
              }
            }}
            className="p-2 hover:bg-white/5 rounded-full transition-colors pointer-events-auto text-white/50 hover:text-white"
          >
            <Maximize2 size={16} />
          </button>
          <button 
            onClick={() => setShowUI(!showUI)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors pointer-events-auto text-white/50 hover:text-white"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex pointer-events-none">
        <AnimatePresence mode="wait">
          {showUI && (
            <>
              {/* Categorized Control Interface */}
              <motion.section 
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                className="w-full sm:w-80 p-4 sm:p-6 z-20 flex flex-col gap-4 pointer-events-auto overflow-y-auto scrollbar-hide max-h-screen"
              >
                {/* Pathway Switcher (Image 1 Influence) */}
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 gap-1 mb-2">
                  {(['standard', 'galactic', 'tde'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPathway(p)}
                      className={`flex-1 py-1.5 text-[8px] font-mono uppercase tracking-widest rounded transition-all ${pathway === p ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'opacity-40 hover:opacity-100'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Unified Tab Controller */}
                <div className="flex justify-between glass-panel p-1 rounded-xl mb-2 flex-shrink-0 gap-0.5">
                  {[
                    { id: 'physics', icon: <Zap size={12} />, label: 'Physics' },
                    { id: 'optics', icon: <Eye size={12} />, label: 'Optics' },
                    { id: 'engine', icon: <Cpu size={12} />, label: 'Engine' },
                    { id: 'neural', icon: <Activity size={12} />, label: 'Data' },
                    { id: 'research', icon: <Database size={12} />, label: 'Info' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg transition-all ${activeTab === tab.id ? 'bg-gradient-to-b from-orange-500 to-orange-600 text-black shadow-lg shadow-orange-500/25' : 'text-white/35 hover:text-white/70 hover:bg-white/5'}`}
                    >
                      {tab.icon}
                      <span className="text-[8px] mt-0.5 font-semibold">{tab.label}</span>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === 'physics' && (
                    <motion.div 
                      key="physics"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4"
                    >
                      <div className="glass-panel p-5 rounded-xl">
                        <div className="mb-6">
                          <h2 className="text-sm font-semibold text-white/80">Geodesic Parameters</h2>
                          <p className="text-[10px] text-white/30 mt-0.5">Kerr metric &amp; spacetime constants</p>
                        </div>
                        <div className="space-y-6">
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="opacity-40 uppercase">NASA Model</span>
                               <select 
                                 value={modelType} 
                                 onChange={(e) => setModelType(parseInt(e.target.value))}
                                 className="bg-black/40 text-orange-400 border border-white/10 rounded px-1 text-[8px] uppercase"
                               >
                                 <option value={0}>Schwarzschild</option>
                                 <option value={1}>Kerr (Spin)</option>
                                 <option value={2}>R-Nordström (Charge)</option>
                                 <option value={3}>Kerr-Newman</option>
                               </select>
                            </div>
                          </div>

                          {[
                            { label: 'Mass (M☉)', val: mass, setter: setMass, min: 0.1, max: 25.0, step: 0.1 },
                            { label: 'Spin (a*)', val: spin, setter: setSpin, min: 0.0, max: 1.95, step: 0.01 },
                            { label: 'Distance (AU)', val: distance, setter: setDistance, min: 2.0, max: 150.0, step: 1.0 },
                            { label: '4D Offset', val: offset4D, setter: setOffset4D, min: -3.14, max: 3.14, step: 0.01 },
                            { label: 'Coupling (λ)', val: coupling, setter: setCoupling, min: 0.1, max: 30.0, step: 0.1 },
                            { label: 'Net Charge (Q)', val: charge, setter: setCharge, min: 0.0, max: 2.0, step: 0.01 },
                            { label: 'Frame Drag (ω)', val: frameDrag, setter: setFrameDrag, min: 0.0, max: 1.0, step: 0.01 },
                            { label: 'Dark Matter', val: darkMatter, setter: setDarkMatter, min: 0.0, max: 2.0, step: 0.1 }
                          ].map(cfg => (
                            <div key={cfg.label} className="space-y-3">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="opacity-40 uppercase">{cfg.label}</span>
                                <span className="text-orange-500">{cfg.val.toFixed(2)}</span>
                              </div>
                              <input 
                                type="range" min={cfg.min} max={cfg.max} step={cfg.step} 
                                value={cfg.val} onChange={(e) => cfg.setter(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Pathway Specific Controls */}
                        {pathway === 'galactic' && (
                          <div className="mt-6 pt-6 border-t border-white/5 space-y-6">
                            <div className="flex items-center gap-2 text-[9px] font-mono text-emerald-400 uppercase tracking-widest">
                              <Wind size={12} /> Galactic Feedback Mechanics
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="opacity-40 uppercase">Cool Gas Fraction</span>
                                <span className="text-emerald-500">{gasFraction.toFixed(1)}%</span>
                              </div>
                              <input 
                                type="range" min="0" max="100" step="1" 
                                value={gasFraction} onChange={(e) => setGasFraction(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="opacity-40 uppercase">AGN Feedback Power</span>
                                <span className="text-emerald-500">{agnPower.toFixed(2)}</span>
                              </div>
                              <input 
                                type="range" min="0" max="1" step="0.01" 
                                value={agnPower} onChange={(e) => setAgnPower(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>
                          </div>
                        )}

                        {pathway === 'tde' && (
                          <div className="mt-6 pt-6 border-t border-white/5 space-y-6">
                            <div className="flex items-center gap-2 text-[9px] font-mono text-blue-400 uppercase tracking-widest">
                              <Star size={12} /> Tidal Disruption Event
                            </div>
                            <button 
                              onClick={triggerTDE}
                              className={`w-full py-4 rounded-xl font-mono text-[9px] uppercase tracking-[0.3em] transition-all border ${isTDEActive ? 'bg-blue-500/20 text-blue-400 border-blue-500/50 cursor-wait' : 'bg-white/5 hover:bg-white/10 border-white/10'}`}
                            >
                              {isTDEActive ? `Thermal Peak: ${(tdePeak * 100).toFixed(0)}%` : 'Trigger Stellar Disruption'}
                            </button>
                            <div className="p-3 bg-white/5 rounded border border-white/10">
                               <p className="text-[7px] text-white/30 uppercase leading-relaxed">
                                  Simulating the spaghettification of a solar-type star. Accretion rate exceeds Eddington limit in peak phase.
                               </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Advanced Physics Accordion */}
                      <div className="glass-panel rounded-xl overflow-hidden">
                        <button
                          onClick={() => setShowAdvancedPhysics(v => !v)}
                          className="w-full p-5 flex items-center justify-between text-left hover:bg-white/3 transition-all"
                        >
                          <div>
                            <div className="text-sm font-semibold text-white/80">Advanced Physics</div>
                            <div className="text-[10px] text-white/35 mt-0.5">Research-grade parameters from published papers</div>
                          </div>
                          <motion.div
                            animate={{ rotate: showAdvancedPhysics ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-white/30"
                          >
                            ↓
                          </motion.div>
                        </button>

                        <AnimatePresence>
                          {showAdvancedPhysics && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 space-y-6 border-t border-white/5">

                                {/* Accretion Disc — Shakura-Sunyaev */}
                                <div className="pt-5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                    <span className="text-xs font-semibold text-orange-400">Accretion Disc</span>
                                    <span className="text-[9px] text-white/25">Shakura-Sunyaev α-disk model</span>
                                  </div>
                                  <div className="space-y-4">
                                    {[
                                      { label: 'Eddington Ratio  λ = L/L_Edd', val: eddingtonRatio, set: setEddingtonRatio, min: 0.0001, max: 15.0, step: 0.0001, color: 'orange', fmt: (v: number) => v.toFixed(4) },
                                      { label: 'α-Viscosity (Shakura-Sunyaev)', val: diskViscosity, set: setDiskViscosity, min: 0.001, max: 0.5, step: 0.001, color: 'orange', fmt: (v: number) => v.toFixed(3) },
                                      { label: 'Disk Aspect Ratio  H/R', val: diskAspectRatio, set: setDiskAspectRatio, min: 0.001, max: 0.5, step: 0.001, color: 'orange', fmt: (v: number) => v.toFixed(3) },
                                      { label: 'Mass Outflow Rate  ṁ_out', val: massOutflowRate, set: setMassOutflowRate, min: 0.0, max: 1.0, step: 0.005, color: 'orange', fmt: (v: number) => v.toFixed(3) },
                                      { label: 'Disk Wind Speed  (v/c)', val: windVelocity, set: setWindVelocity, min: 0.0, max: 0.95, step: 0.001, color: 'orange', fmt: (v: number) => v.toFixed(3) },
                                      { label: 'TDE Impact Parameter  β', val: impactParameter, set: setImpactParameter, min: 0.1, max: 8.0, step: 0.01, color: 'orange', fmt: (v: number) => v.toFixed(2) },
                                    ].map(p => (
                                      <div key={p.label} className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-[10px] text-white/40">{p.label}</span>
                                          <span className={`text-[10px] font-mono text-${p.color}-400`}>{p.fmt(p.val)}</span>
                                        </div>
                                        <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(parseFloat(e.target.value))} className={`w-full h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-${p.color}-500`} />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Relativistic Jet */}
                                <div className="pt-4 border-t border-white/5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                    <span className="text-xs font-semibold text-cyan-400">Relativistic Jet</span>
                                    <span className="text-[9px] text-white/25">AGN radio-mode feedback</span>
                                  </div>
                                  <div className="space-y-4">
                                    {[
                                      { label: 'Bulk Lorentz Factor  Γ', val: jetLorentzFactor, set: setJetLorentzFactor, min: 1.0, max: 30.0, step: 0.01, fmt: (v: number) => v.toFixed(2) },
                                      { label: 'Jet Opening Angle  θ (deg)', val: jetOpeningAngle, set: setJetOpeningAngle, min: 0.5, max: 30.0, step: 0.1, fmt: (v: number) => v.toFixed(1) + '°' },
                                      { label: 'Mechanical Feedback Eff.  ε', val: agnFeedbackEff, set: setAgnFeedbackEff, min: 0.0, max: 0.4, step: 0.001, fmt: (v: number) => v.toFixed(3) },
                                    ].map(p => (
                                      <div key={p.label} className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-[10px] text-white/40">{p.label}</span>
                                          <span className="text-[10px] font-mono text-cyan-400">{p.fmt(p.val)}</span>
                                        </div>
                                        <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(parseFloat(e.target.value))} className="w-full h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Host Galaxy / M-σ relation */}
                                <div className="pt-4 border-t border-white/5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                    <span className="text-xs font-semibold text-violet-400">Host Galaxy</span>
                                    <span className="text-[9px] text-white/25">M-σ correlation · NFW halo</span>
                                  </div>
                                  <div className="space-y-4">
                                    {[
                                      { label: 'Stellar Velocity Disp.  σ (km/s)', val: stellarDispersion, set: setStellarDispersion, min: 30, max: 450, step: 0.5, fmt: (v: number) => v.toFixed(1) },
                                      { label: 'M-σ Power-Law Index  α', val: mSigmaAlpha, set: setMSigmaAlpha, min: 3.5, max: 6.0, step: 0.001, fmt: (v: number) => v.toFixed(3) },
                                      { label: 'NFW Concentration  c', val: darkMatterConc, set: setDarkMatterConc, min: 1.0, max: 40.0, step: 0.1, fmt: (v: number) => v.toFixed(1) },
                                      { label: 'Hot Gas Halo Temp.  T (10⁷ K)', val: hotHaloTemp / 1e7, set: (v: number) => setHotHaloTemp(v * 1e7), min: 0.1, max: 30.0, step: 0.01, fmt: (v: number) => v.toFixed(2) + '×10⁷' },
                                    ].map(p => (
                                      <div key={p.label} className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-[10px] text-white/40">{p.label}</span>
                                          <span className="text-[10px] font-mono text-violet-400">{p.fmt(p.val)}</span>
                                        </div>
                                        <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(parseFloat(e.target.value))} className="w-full h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500" />
                                      </div>
                                    ))}
                                    {/* Derived M-σ mass */}
                                    <div className="mt-2 p-3 rounded-lg bg-violet-900/10 border border-violet-500/15">
                                      <div className="text-[9px] text-white/30 mb-1">M-σ Predicted BH Mass</div>
                                      <div className="text-[11px] font-mono text-violet-300">
                                        {(3.1e8 * Math.pow(stellarDispersion / 200, mSigmaAlpha)).toExponential(2)} M☉
                                      </div>
                                      <div className="text-[8px] text-white/20 mt-0.5">Kormendy &amp; Ho 2013, Eq. 3</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Binary Merger / GW */}
                                <div className="pt-4 border-t border-white/5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                    <span className="text-xs font-semibold text-rose-400">Binary Merger</span>
                                    <span className="text-[9px] text-white/25">LIGO/Virgo GW parameters</span>
                                  </div>
                                  <div className="space-y-4">
                                    {[
                                      { label: 'Mass Ratio  q = M₂/M₁', val: massRatio, set: setMassRatio, min: 0.01, max: 1.0, step: 0.001, fmt: (v: number) => v.toFixed(3) },
                                      { label: 'Chirp Mass  ℳ (M☉)', val: chirpMass, set: setChirpMass, min: 1.0, max: 150.0, step: 0.01, fmt: (v: number) => v.toFixed(2) },
                                      { label: 'Orbital Eccentricity  e', val: orbitalEcc, set: setOrbitalEcc, min: 0.0, max: 0.999, step: 0.001, fmt: (v: number) => v.toFixed(3) },
                                      { label: 'Final Merger Spin  a_f', val: finalMergerSpin, set: setFinalMergerSpin, min: 0.0, max: 0.998, step: 0.001, fmt: (v: number) => v.toFixed(3) },
                                    ].map(p => (
                                      <div key={p.label} className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-[10px] text-white/40">{p.label}</span>
                                          <span className="text-[10px] font-mono text-rose-400">{p.fmt(p.val)}</span>
                                        </div>
                                        <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(parseFloat(e.target.value))} className="w-full h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-rose-500" />
                                      </div>
                                    ))}
                                    {/* GW frequency */}
                                    <div className="mt-2 p-3 rounded-lg bg-rose-900/10 border border-rose-500/15">
                                      <div className="text-[9px] text-white/30 mb-1">ISCO GW Frequency</div>
                                      <div className="text-[11px] font-mono text-rose-300">
                                        {chirpMass > 0 ? (4400 / (chirpMass / Math.pow(massRatio * (1 + massRatio) ** 2, 0.6))).toFixed(0) : '—'} Hz
                                      </div>
                                      <div className="text-[8px] text-white/20 mt-0.5">f_ISCO ≈ 4400 / (M_total/M☉) Hz</div>
                                    </div>
                                  </div>
                                </div>

                                {/* S-star / Galactic Centre */}
                                <div className="pt-4 border-t border-white/5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <span className="text-xs font-semibold text-amber-400">S-Star Orbits</span>
                                    <span className="text-[9px] text-white/25">Keck/UCLA · GRAVITY Collab.</span>
                                  </div>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-[10px] text-white/40">S2 Eccentricity  e_S2</span>
                                        <span className="text-[10px] font-mono text-amber-400">{s2Eccentricity.toFixed(4)}</span>
                                      </div>
                                      <input type="range" min={0.1} max={0.999} step={0.0001} value={s2Eccentricity} onChange={e => setS2Eccentricity(parseFloat(e.target.value))} className="w-full h-0.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
                                    </div>
                                    <div className="p-3 rounded-lg bg-amber-900/10 border border-amber-500/15">
                                      <div className="grid grid-cols-2 gap-2 text-[9px]">
                                        <div><span className="text-white/25">Orbital Period</span><div className="font-mono text-amber-300 mt-0.5">{s2OrbitalPeriod.toFixed(4)} yr</div></div>
                                        <div><span className="text-white/25">Eccentricity</span><div className="font-mono text-amber-300 mt-0.5">{s2Eccentricity.toFixed(4)}</div></div>
                                        <div><span className="text-white/25">Precession (GR)</span><div className="font-mono text-amber-300 mt-0.5">11.9 ± 1.9'</div></div>
                                        <div><span className="text-white/25">Data Source</span><div className="font-mono text-amber-300 mt-0.5">GRAVITY 2020</div></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                    </motion.div>
                  )}

                  {activeTab === 'optics' && (
                    <motion.div 
                      key="optics"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4"
                    >
                      <div className="glass-panel p-5 rounded-xl">
                        <div className="mb-6">
                          <h2 className="text-sm font-semibold text-white/80">Light Field</h2>
                          <p className="text-[10px] text-cyan-400/60 mt-0.5">Photon path rendering &amp; optics</p>
                        </div>
                        <div className="space-y-6">
                           <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="opacity-40 uppercase">Exposure</span>
                              <span className="text-cyan-400">{exposure.toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" min="0.1" max="10.0" step="0.1" 
                              value={exposure} onChange={(e) => setExposure(parseFloat(e.target.value))}
                              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                            />
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="opacity-40 uppercase">Star Density</span>
                              <span className="text-cyan-400">{(starCount/1000000).toFixed(1)}M</span>
                            </div>
                            <input 
                              type="range" min="100000" max="10000000" step="100000" 
                              value={starCount} onChange={(e) => setStarCount(parseInt(e.target.value))}
                              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                             {[
                               { label: 'Disk', state: showDisk, toggle: setShowDisk },
                               { label: 'Stars', state: showBackground, toggle: setShowBackground },
                               { label: 'Matrix', state: showMatrix, toggle: setShowMatrix },
                               { label: 'Thermal', state: thermalMode, toggle: setThermalMode }
                             ].map(b => (
                               <button 
                                 key={b.label}
                                 onClick={() => b.toggle(!b.state)} 
                                 className={`p-3 rounded-lg border text-[8px] font-mono uppercase transition-all ${b.state ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                               >
                                 {b.label}
                               </button>
                             ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'engine' && (
                    <motion.div 
                      key="engine"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4"
                    >
                      <div className="glass-panel p-5 rounded-xl">
                        <div className="mb-6">
                          <h2 className="text-sm font-semibold text-white/80">Computation</h2>
                          <p className="text-[10px] text-blue-400/60 mt-0.5">Ray-march engine &amp; research presets</p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3">
                            <button onClick={() => setHighPower(!highPower)} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${highPower ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                               <span className="text-[9px] font-bold uppercase tracking-tighter">Super Sampling</span>
                               <RefreshCw size={10} className={highPower ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={() => setOverclock(!overclock)} className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${overclock ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                               <span className="text-[9px] font-bold uppercase tracking-tighter">Overclock Engine</span>
                               <Zap size={10} className={overclock ? 'animate-pulse' : ''} />
                            </button>
                          </div>
                          
                          {/* Research-Grade Presets */}
                          <div className="pt-2">
                            <div className="text-[10px] font-medium text-white/40 mb-3">Research Presets</div>
                            <div className="space-y-2">
                              {RESEARCH_PRESETS.map(preset => {
                                const catColor = CATEGORY_COLORS[preset.category];
                                const isActive = activePreset === preset.shortName;
                                return (
                                  <button
                                    key={preset.shortName}
                                    onClick={() => loadPreset(preset)}
                                    className={`w-full p-3 rounded-xl border text-left transition-all group ${isActive ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15'}`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span
                                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                                            style={{ background: catColor + '22', color: catColor, border: `1px solid ${catColor}44` }}
                                          >
                                            {CATEGORY_LABELS[preset.category]}
                                          </span>
                                          <span className="text-[9px] text-white/30">{preset.year}</span>
                                        </div>
                                        <div className="text-[11px] font-semibold text-white/90">{preset.name}</div>
                                        <div className="text-[9px] text-white/35 mt-0.5 leading-relaxed line-clamp-2">{preset.description.substring(0, 80)}...</div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-[9px] text-white/30">M = {preset.mass.toFixed(1)}</div>
                                        <div className="text-[9px] text-white/30">a* = {preset.spin.toFixed(2)}</div>
                                        <div className="text-[8px] text-white/20 mt-1">{preset.realMassSolar}</div>
                                      </div>
                                    </div>
                                    <div className="text-[8px] text-white/25 mt-1.5 font-medium">{preset.source}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-xl">
                        <h2 className="text-[9px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-4">Velocity Modulation</h2>
                        <div className="space-y-4">
                           <div className="space-y-2">
                             <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
                               <span>Time Dilation Scale</span>
                               <span className="text-blue-400">{timeScale.toFixed(2)}x</span>
                             </div>
                             <div className="flex gap-1">
                                {[0.1, 0.5, 1.0].map(s => (
                                  <button 
                                    key={s} 
                                    onClick={() => setTimeScale(s)}
                                    className={`flex-1 py-2 rounded text-[8px] font-mono border transition-all ${timeScale === s ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                  >
                                    {s}x {s < 1.0 ? 'Slow' : 'Norm'}
                                  </button>
                                ))}
                             </div>
                           </div>
                           
                           <div className="space-y-2">
                             <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
                               <span>Movement Damping</span>
                               <span className="text-blue-400">{moveScale.toFixed(2)}x</span>
                             </div>
                             <div className="flex gap-1">
                                {[0.2, 0.5, 1.0].map(s => (
                                  <button 
                                    key={s} 
                                    onClick={() => setMoveScale(s)}
                                    className={`flex-1 py-2 rounded text-[8px] font-mono border transition-all ${moveScale === s ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
                                  >
                                    {s}x {s < 1.0 ? 'Damp' : 'Free'}
                                  </button>
                                ))}
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-xl">
                        <h2 className="text-[9px] font-mono text-blue-400 uppercase tracking-[0.2em] mb-4">Export Hub</h2>
                        <div className="space-y-2">
                          <button 
                             onClick={takeScreenshot}
                             className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                          >
                             <div className="flex items-center gap-3">
                                <Camera size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-mono uppercase">Full Matrix Capture</span>
                             </div>
                             <span className="text-[8px] opacity-40">PNG</span>
                          </button>
                          <button 
                             onClick={() => {
                               const data = Array.from({length: 2000}, () => ({
                                 mass: Math.random() * 100,
                                 spin: Math.random(),
                                 charge: Math.random(),
                                 rayMaxDepth: 1000 + Math.floor(Math.random() * 1000),
                                 coupling: Math.random() * 30
                               }));
                               const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
                               const url = URL.createObjectURL(blob);
                               const a = document.createElement('a');
                               a.href = url;
                               a.download = 'sim-params-2k-extreme.json';
                               a.click();
                             }}
                             className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                          >
                             <div className="flex items-center gap-3">
                                <Database size={14} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-mono uppercase">Generate +1k Params</span>
                             </div>
                             <span className="text-[8px] opacity-40">JSON</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'neural' && (
                    <motion.div 
                      key="neural"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4 pb-12 sm:pb-0"
                    >
                      {/* Integrated Stats for Mobile */}
                      <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className="text-[7px] opacity-40 uppercase">Schwarzschild Range</span>
                            <span className="font-mono text-xl">{schRadius}</span>
                         </div>
                         <div className="flex flex-col text-right">
                            <span className="text-[7px] opacity-40 uppercase">Velocity</span>
                            <span className="font-mono text-xl">{(1 + spin * 0.5).toFixed(2)}c</span>
                         </div>
                      </div>

                      {/* DAT View Toggle */}
                      <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 gap-1">
                        {([
                          { id: 'net', label: 'Neural Net', icon: '⬡' },
                          { id: 'mesh', label: '3D Mesh Debug', icon: '◈' },
                        ] as const).map(v => (
                          <button
                            key={v.id}
                            onClick={() => setDatView(v.id)}
                            className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-[8px] font-mono uppercase tracking-widest rounded-lg transition-all ${datView === v.id ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20' : 'opacity-40 hover:opacity-80 text-white'}`}
                          >
                            <span>{v.icon}</span>
                            <span>{v.label}</span>
                          </button>
                        ))}
                      </div>

                      {datView === 'net' ? (
                        <div className="glass-panel p-5 rounded-xl">
                          <NeuralNerveSystem nRef={neuralRef} meshData={meshData} />
                        </div>
                      ) : (
                        <div className="glass-panel p-3 rounded-xl">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <h2 className="text-[9px] font-mono text-orange-400 uppercase tracking-[0.2em]">3D Node Mesh · Assessment Model</h2>
                            <div className="flex gap-2 text-[7px] font-mono text-white/30">
                              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">{layerCountsForDebug.reduce((a, b) => a + b, 0)} nodes</span>
                              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">Live</span>
                            </div>
                          </div>
                          <MeshDebug3D nRef={neuralRef} meshData={meshData} />
                          <div className="mt-3 grid grid-cols-3 gap-2 text-[7px] font-mono">
                            {['Mass', 'Spin', 'Disk', 'Dist', 'Coupling', 'Aberr'].map((label, i) => {
                              const val = neuralRef.current.state[i] ?? 0;
                              const act = neuralRef.current.activity[i] ?? 0;
                              return (
                                <div key={label} className="bg-black/40 rounded-lg p-2 border border-white/5">
                                  <div className="text-white/30 uppercase tracking-wider mb-1">{label}</div>
                                  <div className="text-orange-400 font-bold">{(typeof val === 'number' ? val : 0).toFixed(2)}</div>
                                  <div className="w-full h-0.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                                    <div
                                      className="h-full bg-orange-500 transition-all duration-300"
                                      style={{ width: `${Math.min(100, Math.abs(typeof act === 'number' ? act : 0) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <div className="glass-panel p-5 rounded-xl flex-1 overflow-hidden relative group h-48 sm:h-auto">
                        <div className="absolute inset-0 p-5 overflow-y-auto scrollbar-hide">
                          <h2 className="text-[9px] font-mono text-orange-400 uppercase tracking-[0.2em] mb-4">Quantum Integration</h2>
                          <MathMatrixOverlay />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'research' && (
                    <motion.div 
                      key="research"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-4"
                    >
                      <div className="glass-panel p-5 rounded-xl border-red-500/30">
                        <div className="flex items-center justify-between mb-4">
                           <h2 className="text-[9px] font-mono text-red-400 uppercase tracking-[0.2em] flex items-center gap-2">
                              <Database size={12} /> Stolen Enemy Intelligence
                           </h2>
                           <span className="text-[8px] px-2 py-0.5 bg-red-500/20 text-red-500 rounded-full font-mono animate-pulse">BREACHED</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                           <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                              <div className="text-[8px] opacity-40 uppercase mb-1">Black Hole Core</div>
                              <div className="text-[12px] font-mono text-white">4.154e6 M☉</div>
                              <div className="w-full h-1 bg-white/10 mt-2 rounded-full overflow-hidden">
                                 <div className="h-full bg-red-500" style={{ width: '84%' }}></div>
                              </div>
                           </div>
                           <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                              <div className="text-[8px] opacity-40 uppercase mb-1">Spin Factor</div>
                              <div className="text-[12px] font-mono text-white">0.84 a*</div>
                              <div className="w-full h-1 bg-white/10 mt-2 rounded-full overflow-hidden">
                                 <div className="h-full bg-orange-500" style={{ width: '84%' }}></div>
                              </div>
                           </div>
                        </div>

                        <h3 className="text-[8px] font-mono text-white/40 uppercase mb-3 text-right">Stellar Census Distribution</h3>
                        <div className="h-40 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[
                                 { name: 'HIP', val: 40000 },
                                 { name: 'GAIA', val: 25000 },
                                 { name: '2MASS', val: 10000 },
                                 { name: 'VAR', val: 3500 }
                              ]}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                 <XAxis dataKey="name" hide />
                                 <YAxis hide />
                                 <Tooltip 
                                    contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', fontSize: '8px' }}
                                    itemStyle={{ color: '#ef4444' }}
                                 />
                                 <Line type="monotone" dataKey="val" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                              </LineChart>
                           </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-4 gap-1 mt-2">
                           {['HIP', 'GAIA', '2MASS', 'VAR'].map(l => (
                              <div key={l} className="text-[7px] text-center opacity-30 font-mono">{l}</div>
                           ))}
                        </div>
                      </div>

                       <div className="glass-panel p-5 rounded-xl border-l-4 border-emerald-500 shadow-xl shadow-emerald-500/5">
                        <h2 className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.4em] mb-4">BH Classification</h2>
                        <div className="space-y-4">
                           <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-mono text-white">{bhClass.type}</span>
                              <span className="text-[9px] font-mono opacity-50 uppercase">{bhClass.desc}</span>
                           </div>
                           <p className="text-[8px] font-mono opacity-60 leading-relaxed uppercase">
                              Path: {pathway} module // {pathway === 'galactic' ? 'Regulating host galaxy cool gas accretion.' : 'Standalone singularity metrics applied.'}
                           </p>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-xl border-cyan-500/30">
                        <h2 className="text-[9px] font-mono text-cyan-400 uppercase tracking-[0.2em] mb-4">4D Topology Matrix</h2>
                        <div className="grid grid-cols-2 gap-2">
                           {['Tesseract', 'Hypersphere', '3-Torus', 'Klein-X'].map(shape => (
                              <button 
                                key={shape}
                                onClick={() => setShow4D(!show4D)}
                                className={`p-3 border rounded-lg text-[8px] font-mono uppercase transition-all ${show4D ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-white/5 border-white/5 text-white/50 hover:bg-white/10'}`}
                              >
                                {shape}
                              </button>
                           ))}
                        </div>
                      </div>

                      {/* M-Sigma Correlation Graph */}
                      <div className="glass-panel p-5 rounded-xl h-64 shadow-inner">
                         <h2 className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.4em] mb-4">M-Sigma Correlation</h2>
                         <div className="w-full h-48 opacity-80">
                            <ResponsiveContainer width="100%" height="100%">
                               <LineChart data={[
                                  { sigma: 100, mass: 6.5 },
                                  { sigma: 150, mass: 7.2 },
                                  { sigma: 200, mass: 8.0 },
                                  { sigma: 250, mass: 8.8 },
                                  { sigma: 300, mass: 9.5 }
                               ]}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff11" vertical={false} />
                                  <XAxis dataKey="sigma" stroke="#ffffff22" fontSize={8} tickFormatter={(v) => `${v} km/s`} />
                                  <YAxis stroke="#ffffff22" fontSize={8} label={{ value: 'log(M)', angle: -90, position: 'insideLeft', fontSize: 6 }} />
                                  <Tooltip 
                                    contentStyle={{ background: '#000', border: '1px solid #ffffff11', fontSize: '8px' }}
                                    itemStyle={{ color: '#10b981' }}
                                  />
                                  <Line type="monotone" dataKey="mass" stroke="#10b981" dot={{ r: 2, fill: '#10b981' }} />
                                  <Line data={[{ sigma: 100 + mass * 2, mass: Math.log10(mass * 1e7) }]} type="monotone" dataKey="mass" stroke="#f97316" dot={{ r: 4, fill: '#f97316' }} />
                               </LineChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1"></div>

        {/* Desktop-Only Stats Panel */}
        <AnimatePresence>
          {showUI && (
            <motion.section 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="hidden lg:flex w-80 p-6 z-20 flex-col gap-4 items-end pointer-events-auto"
            >
              {/* Existing Right Sidebar Content remains here for desktop */}
              <div className="glass-panel p-6 rounded-xl w-full">
                <div className="text-right mb-6">
                  <div className="text-4xl font-mono leading-none tracking-tight font-light">{schRadius}</div>
                  <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest mt-2">Schwarzschild Radius (km)</div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
                  <div className="space-y-1">
                    <div className="text-[14px] font-mono">{(1 + spin * 0.5).toFixed(2)}c</div>
                    <div className="text-[8px] font-mono text-white/40 uppercase tracking-tighter">Frame Dragging</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[14px] font-mono text-orange-400">Active</div>
                    <div className="text-[8px] font-mono text-white/40 uppercase tracking-tighter">Grav-Lensing</div>
                  </div>
                </div>
              </div>

              <div className="w-full flex-1 flex flex-col gap-3">
                <div className="h-40 w-full glass-panel rounded-xl relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 w-full h-1/2 flex items-end gap-1 px-3 pb-3">
                    {[40, 60, 30, 80, 50, 90, 45, 70, 35, 85].map((h, i) => (
                      <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse', delay: i * 0.1 }}
                        className="bg-orange-500/30 w-full rounded-t-sm"
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 p-4">
                    <span className="text-[9px] font-mono opacity-40 uppercase tracking-widest text-white/60">Radiative Energy Flux</span>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="h-20 glass-panel border-t-0 border-x-0 border-b-0 flex items-center px-8 justify-between z-30 pointer-events-auto">
        <div className="flex gap-4">
          <button 
            className="px-6 py-2.5 bg-orange-500 text-black text-[11px] font-bold uppercase tracking-[0.2em] rounded hover:bg-orange-400 transition-colors shadow-[0_0_20px_rgba(249,115,22,0.3)]"
            onClick={() => { setMass(10.0); setSpin(0.8); setDistance(50.0); setRayMaxDepth(2000); }}
          >
            Reset Metrics
          </button>
          <button className="px-6 py-2.5 border border-white/10 text-white/70 text-[11px] font-bold uppercase tracking-[0.2em] rounded hover:bg-white/5 hover:text-white transition-all">
            Export Data
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-1.5 h-1.5 ${i === 1 ? 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'bg-white/20'}`}></div>
            ))}
          </div>
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest hidden sm:inline">
            COORDINATES: RA 17h 45m 40s | Dec −29° 00′ 28″ (Sagittarius A*)
          </span>
        </div>
      </footer>

      {/* 4D Floating Window */}
      <AnimatePresence>
        {show4DWindow && (
          <FourDPanel
            mass={mass}
            spin={spin}
            offset4D={offset4D}
            coupling={coupling}
            onClose={() => setShow4DWindow(false)}
          />
        )}
      </AnimatePresence>

      {/* Scanning Lines Effect overlay */}
      <div className="absolute inset-0 pointer-events-none z-50 opacity-[0.03] overflow-hidden mix-blend-overlay">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      </div>
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
