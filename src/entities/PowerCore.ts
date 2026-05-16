import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Config } from '../game/GameConfig'

// Power Core = the base the defender is protecting. The body is a Meshy GLB.
// Both a textured and a plain (geometry-only) variant are loaded so the user
// can hot-swap with the 'T' key during testing to compare them.
//
// Both variants get the SAME procedural effect overlay (rotation, emissive
// pulse, particle aura) so a fair comparison reveals what textures actually
// add on top of our base presentation.

export type CoreVariant = 'plain' | 'textured'

const MODELS: Record<CoreVariant, string> = {
  plain:    '/models/powercore/plain.glb',
  textured: '/models/powercore/textured.glb',
}

// Target visible height in world units. Both variants are auto-scaled to this
// regardless of their native model size, so swapping doesn't change footprint.
const TARGET_HEIGHT = 85
const ROTATION_RAD_PER_SEC = 0.18    // slow spin — readable but not distracting
const PARTICLE_COUNT = 10
const PARTICLE_RADIUS = TARGET_HEIGHT * 0.55  // orbit radius around the core's vertical axis

// Module-level cache populated by preloadPowerCore(). Each entry is the raw
// gltf.scene from the loader — we clone it per PowerCore instance.
const templates: Partial<Record<CoreVariant, { scene: THREE.Group; scale: number }>> = {}

export async function preloadPowerCore(): Promise<void> {
  const loader = new GLTFLoader()
  await Promise.all((Object.keys(MODELS) as CoreVariant[]).map(key =>
    new Promise<void>((resolve, reject) => {
      loader.load(
        MODELS[key],
        gltf => {
          const bbox = new THREE.Box3().setFromObject(gltf.scene)
          const size = new THREE.Vector3(); bbox.getSize(size)
          const native = size.y || 1
          templates[key] = { scene: gltf.scene, scale: TARGET_HEIGHT / native }
          resolve()
        },
        undefined,
        err => { console.warn(`[PowerCore] ${key} failed to load`, err); resolve() }
      )
    })
  ))
}

// Per-mesh material baselines captured when a variant is swapped in, so the
// pulse can multiply against the variant's "natural" emissive strength and
// the hit-flash can restore exactly what it changed.
type MaterialBaseline = {
  mat: THREE.MeshStandardMaterial
  emissiveHex: number
  emissiveIntensity: number
}

interface Particle {
  mesh: THREE.Mesh
  angle: number
  angularSpeed: number
  yOffset: number
  yPhase: number   // for vertical bobbing
  yAmp: number
}

export class PowerCore {
  readonly mesh: THREE.Group
  hp: number
  readonly maxHp: number
  private hpBarGroup: THREE.Group
  private hpBar: THREE.Mesh
  private bodyGroup: THREE.Group | null = null
  private pointLight: THREE.PointLight
  private pulseTime = 0
  private currentVariant: CoreVariant = 'plain'
  private baselines: MaterialBaseline[] = []
  private particles: Particle[] = []

  constructor(scene: THREE.Scene) {
    this.hp = this.maxHp = Config.POWER_CORE.HP
    this.mesh = new THREE.Group()
    this.mesh.position.set(Config.POWER_CORE.X, Config.POWER_CORE.Y, 0)

    // Cyan ambient glow, intensity pulsed in update().
    this.pointLight = new THREE.PointLight(0x00aaff, 3.5, 240)
    this.pointLight.position.set(0, TARGET_HEIGHT * 0.5, 0)
    this.mesh.add(this.pointLight)

    // Particle aura — 10 small emissive motes orbiting the core. Sits on the
    // PowerCore group (not the bodyGroup) so it doesn't get torn down when
    // variants swap.
    this.buildParticles()

    // HP bar — billboarded.
    this.hpBarGroup = new THREE.Group()
    this.hpBarGroup.position.set(0, TARGET_HEIGHT * 1.12, 0)
    const bgBar = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 8),
      new THREE.MeshBasicMaterial({ color: 0xcc2222 })
    )
    bgBar.position.z = 0.1
    this.hpBarGroup.add(bgBar)
    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    )
    this.hpBar.position.z = 0.2
    this.hpBarGroup.add(this.hpBar)
    this.mesh.add(this.hpBarGroup)

    this.setVariant('plain')
    scene.add(this.mesh)
  }

  setVariant(variant: CoreVariant) {
    if (this.bodyGroup) {
      this.mesh.remove(this.bodyGroup)
      this.bodyGroup = null
    }
    const tpl = templates[variant]
    if (!tpl) { this.buildFallback(); return }

    const clone = tpl.scene.clone(true)
    clone.scale.setScalar(tpl.scale)

    if (variant === 'plain') {
      // Plain export ships as flat gray geometry. Replace materials so the
      // core has a base color identity. Pulse + rotation + particles below
      // give it the "alive" feel even without any baked Meshy textures.
      clone.traverse(obj => {
        if (!(obj instanceof THREE.Mesh)) return
        const baseMat = obj.material as THREE.MeshStandardMaterial
        const tinted = new THREE.MeshStandardMaterial({
          color: 0x1f2e3a,
          emissive: new THREE.Color(0x00bbff),
          emissiveIntensity: 1.1,
          metalness: 0.55,
          roughness: 0.45,
        })
        if (baseMat && 'normalMap' in baseMat && baseMat.normalMap) {
          tinted.normalMap = baseMat.normalMap
        }
        obj.material = tinted
      })
    }

    this.bodyGroup = clone
    this.mesh.add(clone)
    this.currentVariant = variant

    // Capture per-material baselines so the pulse multiplier + flash-on-hit
    // can return to exactly what the variant was authored with.
    this.baselines = []
    clone.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material as THREE.MeshStandardMaterial
      if (!mat || !('emissive' in mat)) return
      this.baselines.push({
        mat,
        emissiveHex: mat.emissive.getHex(),
        emissiveIntensity: mat.emissiveIntensity ?? 1,
      })
    })
  }

  toggleVariant(): CoreVariant {
    const next: CoreVariant = this.currentVariant === 'plain' ? 'textured' : 'plain'
    this.setVariant(next)
    return next
  }

  get variant(): CoreVariant { return this.currentVariant }

  faceCamera(camera: THREE.Camera) {
    this.hpBarGroup.quaternion.copy(camera.quaternion)
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    const ratio = this.hp / this.maxHp
    this.hpBar.scale.x = ratio
    this.hpBar.position.x = -(1 - ratio) * 35
    const mat = this.hpBar.material as THREE.MeshBasicMaterial
    mat.color.setHex(ratio > 0.5 ? 0x00ff88 : ratio > 0.25 ? 0xffaa00 : 0xff2200)
    this.flashHit()
  }

  // Brief red flash on the point light AND every emissive material, then
  // restore baselines (pulse will re-multiply against those next frame).
  private flashHit() {
    this.pointLight.color.setHex(0xff2200)
    this.pointLight.intensity = 6
    for (const b of this.baselines) {
      b.mat.emissive.setHex(0xff2200)
      b.mat.emissiveIntensity = 2.5
    }
    setTimeout(() => {
      this.pointLight.color.setHex(0x00aaff)
      for (const b of this.baselines) {
        b.mat.emissive.setHex(b.emissiveHex)
        b.mat.emissiveIntensity = b.emissiveIntensity
      }
    }, 200)
  }

  private buildFallback() {
    const size = Config.POWER_CORE.RADIUS * 2.4
    const group = new THREE.Group()
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size * 0.75),
      new THREE.MeshStandardMaterial({ color: 0x335577, emissive: 0x00aaff, emissiveIntensity: 0.6 })
    )
    box.position.set(0, size / 2, 0)
    group.add(box)
    this.bodyGroup = group
    this.mesh.add(group)
  }

  // 10 emissive cyan motes orbiting the core. Each has its own angular speed
  // and a small vertical bobbing component so the aura never reads as a
  // perfect ring — feels organic / energetic.
  private buildParticles() {
    const geo = new THREE.SphereGeometry(1.8, 6, 6)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x66eeff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = new THREE.Mesh(geo, mat)
      m.renderOrder = 5
      this.mesh.add(m)
      this.particles.push({
        mesh: m,
        angle: (i / PARTICLE_COUNT) * Math.PI * 2,
        angularSpeed: 0.6 + Math.random() * 0.6,   // 0.6–1.2 rad/sec
        yOffset: TARGET_HEIGHT * (0.25 + Math.random() * 0.6),
        yPhase: Math.random() * Math.PI * 2,
        yAmp: 4 + Math.random() * 4,
      })
    }
  }

  get isDead() { return this.hp <= 0 }

  update(delta: number) {
    this.pulseTime += delta

    // 1) Idle Y rotation on the body — slow and constant. Skipped on the HP
    //    bar group (handled by faceCamera) so the bar stays readable.
    if (this.bodyGroup) this.bodyGroup.rotation.y += ROTATION_RAD_PER_SEC * delta

    // 2) Emissive pulse on every captured material, multiplied against its
    //    baseline so textured exports breathe in their own colors and plain
    //    pulses in cyan. 0.7–1.4× baseline at ~0.35 Hz.
    const pulse = 1 + Math.sin(this.pulseTime * 2.2) * 0.35
    for (const b of this.baselines) {
      b.mat.emissiveIntensity = b.emissiveIntensity * pulse
    }

    // 3) Ambient point light pulses in cyan range, same rate.
    this.pointLight.intensity = 3.5 + Math.sin(this.pulseTime * 2.2) * 0.9

    // 4) Particle motes orbit + bob.
    for (const p of this.particles) {
      p.angle += p.angularSpeed * delta
      const x = Math.cos(p.angle) * PARTICLE_RADIUS
      const z = Math.sin(p.angle) * PARTICLE_RADIUS
      const y = p.yOffset + Math.sin(this.pulseTime * 2 + p.yPhase) * p.yAmp
      p.mesh.position.set(x, y, z)
    }
  }
}
