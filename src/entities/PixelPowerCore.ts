import * as THREE from 'three'
import { Config } from '../game/GameConfig'

// 2D-sprite alternative to the GLB-based PowerCore. Same public surface
// (takeDamage, faceCamera, update, isDead, mesh) so it can drop into the
// Game/BattlePhase wiring in place of PowerCore if the user prefers it.
//
// Why this exists: the GLB super core has back-half spike occlusion under
// the fixed 45° camera (the dome cap geometrically hides the spikes on the
// far side). A billboarded sprite always faces the camera, so there's no
// far-side geometry to be hidden — same reason the sphere defender doesn't
// have the problem.

const DIRECTIONS = [
  'south', 'south-east', 'east', 'north-east',
  'north', 'north-west', 'west', 'south-west',
] as const
const FRAME_INTERVAL = 0.5    // s per direction → ~4 s full spin (slower than sphere)
const SCREEN_SIZE = 130       // sprite world-units — sized to match the GLB core's height

const textures: THREE.Texture[] = []
let loaded = false

export async function preloadPixelPowerCore(): Promise<void> {
  const loader = new THREE.TextureLoader()
  await Promise.all(DIRECTIONS.map((dir, i) =>
    new Promise<void>((resolve, reject) => {
      loader.load(
        `/sprites/powercore/${dir}.png`,
        tex => {
          tex.magFilter = THREE.NearestFilter
          tex.minFilter = THREE.NearestFilter
          tex.colorSpace = THREE.SRGBColorSpace
          textures[i] = tex
          resolve()
        },
        undefined,
        reject
      )
    })
  ))
  loaded = true
}

export class PixelPowerCore {
  readonly mesh: THREE.Group
  hp: number
  readonly maxHp: number
  private sprite: THREE.Sprite
  private hpBarGroup: THREE.Group
  private hpBar: THREE.Mesh
  private spinTime = 0
  private frameIndex = 0

  constructor(scene: THREE.Scene, x: number, y: number) {
    this.hp = this.maxHp = Config.POWER_CORE.HP
    this.mesh = new THREE.Group()
    this.mesh.position.set(x, y, 0)

    const firstTex = loaded ? textures[0] : null
    const mat = new THREE.SpriteMaterial({
      map: firstTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      alphaTest: 0.1,
    })
    this.sprite = new THREE.Sprite(mat)
    this.sprite.scale.set(SCREEN_SIZE, SCREEN_SIZE, 1)
    this.sprite.position.set(0, SCREEN_SIZE * 0.35, 5)   // feet near ground
    this.sprite.renderOrder = 10
    this.mesh.add(this.sprite)

    // HP bar above sprite, billboarded.
    this.hpBarGroup = new THREE.Group()
    this.hpBarGroup.position.set(0, SCREEN_SIZE * 0.78, 0)
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 8),
      new THREE.MeshBasicMaterial({ color: 0xcc2222 })
    )
    bg.position.z = 0.1
    this.hpBarGroup.add(bg)
    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    )
    this.hpBar.position.z = 0.2
    this.hpBarGroup.add(this.hpBar)
    this.mesh.add(this.hpBarGroup)

    scene.add(this.mesh)
  }

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
  }

  get isDead() { return this.hp <= 0 }

  update(delta: number) {
    if (!loaded) return
    this.spinTime += delta
    const next = Math.floor(this.spinTime / FRAME_INTERVAL) % DIRECTIONS.length
    if (next !== this.frameIndex) {
      this.frameIndex = next
      this.sprite.material.map = textures[next]
      this.sprite.material.needsUpdate = true
    }
  }
}
