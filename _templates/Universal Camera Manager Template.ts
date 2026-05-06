import * as THREE from 'three';

/**
 * CAMERA MANAGER TIPS FOR CLAUDE:
 * 1. Coordinates: Use Y-up.
 * 2. Smoothing: Use lerp for all transitions to avoid "jitter."
 * 3. Lifecycle: Always call update() in the main animation loop.
 */
export class CameraManager {
  private static instance: CameraManager;
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public offset: THREE.Vector3 = new THREE.Vector3(0, 5, 10); // Default follow distance
  
  private lerpFactor: number = 0.1; // 0 to 1 (stiffness)

  private constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      2000
    );
    
    this.setupListeners();
  }

  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  private setupListeners() {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      if (width === 0 || height === 0) return;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
  }

  /**
   * Use this for First/Third Person following logic.
   * Claude: Ensure 'delta' is passed from the main clock.
   */
  public followTarget(targetPos: THREE.Vector3, delta: number) {
    const idealPosition = targetPos.clone().add(this.offset);
    
    // Smoothly interpolate position
    this.camera.position.lerp(idealPosition, this.lerpFactor);
    
    // Ensure we are always looking at the target
    this.camera.lookAt(targetPos);
  }

  /**
   * Camera Shake for impacts/explosions.
   */
  public shake(intensity: number) {
    this.camera.position.x += (Math.random() - 0.5) * intensity;
    this.camera.position.y += (Math.random() - 0.5) * intensity;
  }
}