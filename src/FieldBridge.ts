import { MetricData } from './PhysicsEngine';

/**
 * FieldBridge
 * Couples the Black Hole core physics fields to the Neural Mesh system.
 * Keeps the interface modular, read-only from the mesh side, and detached from rendering.
 */

export interface MeshNodeWeightMap {
    forceX: number;
    forceY: number;
    forceZ: number;
    gravityScale: number;
    tension: number;
    anomalyTrigger: boolean;
    energyBoost: number;
}

export function blackHoleFieldToMeshData(field: MetricData, currentPos: {x: number, y: number, z: number}): MeshNodeWeightMap {
    // Map spin and frame dragging into node flow direction
    const forceX = field.velocity_field.x * 0.05;
    const forceY = field.velocity_field.y * 0.05;
    const forceZ = field.velocity_field.z * 0.05;
    
    // Map curvature, energy density, stability, and gravity into mesh node weights
    const gravityScale = field.gravitational_strength * 0.001;
    
    // Map horizon proximity into edge tension
    // If stability index is low (closer to horizon), tension increases
    const tension = 1.0 + Math.max(0, (1.0 - field.stability_index) * 2.0);
    
    // Map instability zones into anomaly nodes
    const anomalyTrigger = field.stability_index < 0.2 && Math.random() < 0.005;
    
    // Energy density -> energy boost
    const energyBoost = field.energy_density * 0.01;

    return {
        forceX,
        forceY,
        forceZ,
        gravityScale,
        tension,
        anomalyTrigger,
        energyBoost
    };
}

export function meshDataToSignal(nodeState: number, nodeType: number, energy: number, index: number) {
    if (nodeType === 3 || energy > 2.0) {
        return { type: 'ANOMALY_DETECTED', index, energy };
    }
    return null;
}
