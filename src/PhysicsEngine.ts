/**
 * PhysicsEngine
 * Abstract spacetime metric system providing curvature and field approximation
 * for Schwarzschild, Kerr, Reissner-Nordström, and Kerr-Newman models.
 * Operates independently from the WebGL shaders to feed data strictly to the Neural Mesh
 * and other analytical interlayers.
 */

export interface MetricData {
    curvature: number;
    gravitational_strength: number;
    velocity_field: { x: number; y: number; z: number };
    energy_density: number;
    stability_index: number;
}
  
export class PhysicsEngine {
    mass: number = 1.0;
    spin: number = 0.0;
    charge: number = 0.0;
    modelType: number = 0; // 0:Schwarz, 1:Kerr, 2:RN, 3:KN

    updateParams(mass: number, spin: number, charge: number, modelType: number) {
        this.mass = mass;
        this.spin = spin;
        this.charge = charge;
        this.modelType = modelType;
    }

    getEventHorizon(): number {
        const rs = 1.0 * this.mass;
        const a = this.spin * this.mass;
        const q = this.charge * this.mass;
        const insideSqrt = Math.max(0.0, rs * rs - a * a - q * q);
        return rs + Math.sqrt(insideSqrt);
    }

    getErgosphere(theta: number): number {
        const rs = 1.0 * this.mass;
        const a = this.spin * this.mass;
        const q = this.charge * this.mass;
        const cosT = Math.cos(theta);
        const insideSqrt = Math.max(0.0, rs * rs - a * a * cosT * cosT - q * q);
        return rs + Math.sqrt(insideSqrt);
    }

    getField(x: number, y: number, z: number): MetricData {
        const r = Math.sqrt(x * x + y * y + z * z) || 1e-6;
        const theta = Math.acos(y / r);
        
        const horizon = this.getEventHorizon();
        const ergo = this.getErgosphere(theta);
        
        // Curvature approx
        const curvature = this.mass / (r * r * r);
        
        // Gravitational strength
        const strength = (this.mass * r) / Math.pow(Math.max(r - horizon + 1.0, 0.1), 2);
        
        // Frame dragging velocity field rough approx (Kerr)
        let vx = 0, vy = 0, vz = 0;
        const a = this.spin * this.mass;
        if (this.modelType === 1 || this.modelType === 3) {
            if (r < ergo && r > horizon) {
                const drag = this.spin / (r * r + a * a * Math.cos(theta) * Math.cos(theta));
                vx = -z * drag;
                vz = x * drag;
            }
        }

        return {
            curvature,
            gravitational_strength: strength,
            velocity_field: { x: vx, y: vy, z: vz },
            energy_density: curvature * this.mass,
            stability_index: r <= horizon ? 0.0 : Math.min(1.0, (r - horizon) / 5.0)
        };
    }

    getGlobalMetrics() {
        return {
            global_energy: this.mass * 1.5 + this.spin * 0.5 + this.charge * 0.2, // Arbitrary composite
            entropy_estimate: this.mass * this.mass + this.spin * this.spin * 0.5,
            horizon_radius: this.getEventHorizon()
        };
    }
}

export const globalPhysicsEngine = new PhysicsEngine();
