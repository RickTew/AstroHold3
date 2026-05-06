import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Config, UnitType } from '../game/GameConfig'

// Adjust scale based on how your Meshy model comes in — tweak during playtesting
const MODEL_SCALE = 0.12
// Rotate so the biped faces the camera (tilt 90° on X) rather than appearing as a flat top-down silhouette
const MODEL_TILT_X = Math.PI / 2

type LoadedGLTF = { scene: THREE.Group; animations: THREE.AnimationClip[] }
let cachedGLTF: LoadedGLTF | null = null
const loader = new GLTFLoader()

export class Unit {
  readonly mesh: THREE.Group
  hp: number
  readonly maxHp: number
  readonly type: UnitType
  isDead = false
  private mixer: THREE.AnimationMixer | null = null
  private hpBar: THREE.Mesh

  static async preload(): Promise<void> {
    return new Promise((resolve, reject) => {
      loader.load(
        '/models/cyborg/running.glb',
        (gltf) => {
          cachedGLTF = gltf as unknown as LoadedGLTF
          resolve()
        },
        undefined,
        (err) => {
          console.warn('Cyborg GLB failed to load, using fallback geometry:', err)
          resolve()  // don't block startup
        }
      )
    })
  }

  constructor(scene: THREE.Scene, type: UnitType, spawnX: number) {
    this.type = type
    this.hp = this.maxHp = Config.UNITS[type].hp
    this.mesh = new THREE.Group()

    const spawnY = (Math.random() - 0.5) * 580
    this.mesh.position.set(spawnX, spawnY, 0)

    if (cachedGLTF) {
      this.loadModel(cachedGLTF)
    } else {
      this.buildFallback()
    }

    this.hpBar = this.buildHpBar()
    scene.add(this.mesh)
  }

  private loadModel(gltf: LoadedGLTF) {
    const clone = skeletonClone(gltf.scene) as THREE.Group
    clone.scale.setScalar(MODEL_SCALE)
    clone.rotation.x = MODEL_TILT_X

    const emissiveColor = new THREE.Color(Config.UNITS[this.type].color)
    clone.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        const src = obj.material as THREE.MeshStandardMaterial
        const mat = src.clone()
        mat.emissive = emissiveColor
        mat.emissiveIntensity = 0.35
        obj.material = mat
      }
    })

    this.mesh.add(clone)

    if (gltf.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(clone)
      const action = this.mixer.clipAction(gltf.animations[0])
      action.play()
    }
  }

  private buildFallback() {
    const geo = new THREE.BoxGeometry(20, 26, 14)
    const mat = new THREE.MeshBasicMaterial({ color: Config.UNITS[this.type].color })
    this.mesh.add(new THREE.Mesh(geo, mat))
  }

  private buildHpBar(): THREE.Mesh {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 4),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    )
    bg.position.set(0, 22, 0.1)
    this.mesh.add(bg)

    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 4),
      new THREE.MeshBasicMaterial({ color: 0x00cc44 })
    )
    fill.position.set(0, 22, 0.2)
    this.mesh.add(fill)
    return fill
  }

  update(delta: number) {
    this.mixer?.update(delta)
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) {
      this.isDead = true
      this.mesh.removeFromParent()
    } else {
      const ratio = this.hp / this.maxHp
      this.hpBar.scale.x = ratio
      this.hpBar.position.x = -(1 - ratio) * 15
      const mat = this.hpBar.material as THREE.MeshBasicMaterial
      mat.color.setHex(ratio > 0.5 ? 0x00cc44 : ratio > 0.25 ? 0xffaa00 : 0xff2200)
    }
  }

  get worldX() { return this.mesh.position.x }
  get worldY() { return this.mesh.position.y }
  get speed()  { return Config.UNITS[this.type].speed }
  get damage() { return Config.UNITS[this.type].damage }
  get isScout()  { return this.type === 'scout' }
  get isBomber() { return this.type === 'bomber' }
}
