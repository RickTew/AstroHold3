import * as THREE from 'three'
import { Config } from '../game/GameConfig'

export class PowerCore {
  readonly mesh: THREE.Group
  hp: number
  readonly maxHp: number
  private hpBar: THREE.Mesh
  private coreMesh: THREE.Mesh
  private pulseTime = 0

  constructor(scene: THREE.Scene) {
    this.hp = this.maxHp = Config.POWER_CORE.HP
    this.mesh = new THREE.Group()
    this.mesh.position.set(Config.POWER_CORE.X, Config.POWER_CORE.Y, 0)

    // Outer glow ring
    const ringGeo = new THREE.TorusGeometry(Config.POWER_CORE.RADIUS + 8, 3, 8, 32)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.6 })
    this.mesh.add(new THREE.Mesh(ringGeo, ringMat))

    // Core sphere
    const geo = new THREE.SphereGeometry(Config.POWER_CORE.RADIUS, 16, 16)
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffee })
    this.coreMesh = new THREE.Mesh(geo, mat)
    this.mesh.add(this.coreMesh)

    // HP bar background
    const bgBar = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 8),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    )
    bgBar.position.set(0, 44, 0.1)
    this.mesh.add(bgBar)

    // HP bar fill
    this.hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    )
    this.hpBar.position.set(0, 44, 0.2)
    this.mesh.add(this.hpBar)

    scene.add(this.mesh)
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount)
    const ratio = this.hp / this.maxHp
    this.hpBar.scale.x = ratio
    this.hpBar.position.x = -(1 - ratio) * 35
    const mat = this.hpBar.material as THREE.MeshBasicMaterial
    mat.color.setHex(ratio > 0.5 ? 0x00ff88 : ratio > 0.25 ? 0xffaa00 : 0xff2200)
    // Flash core red on hit
    const coreMat = this.coreMesh.material as THREE.MeshBasicMaterial
    coreMat.color.setHex(0xff4400)
    setTimeout(() => coreMat.color.setHex(0x00ffee), 200)
  }

  get isDead() { return this.hp <= 0 }

  update(delta: number) {
    this.pulseTime += delta * 2.5
    const s = 1 + Math.sin(this.pulseTime) * 0.08
    this.coreMesh.scale.setScalar(s)
  }
}
