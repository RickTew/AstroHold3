import * as THREE from 'three'
import { getGrenadeTexture } from './Structure'

// A live proximity-trigger grenade sitting on an empty cell. Lobbed by a
// Bomber / Grenadier — the projectile lands here, the visual transitions to
// this pulsing sprite, and the bomb stays in place until any enemy enters
// the aoeRadius. Then it detonates (handled by RevealPhase). The owner ID
// gates one-bomb-per-thrower: a Bomber/Grenadier can't throw a new bomb
// while any PendingGrenade with their ownerId is still on the field.
export class PendingGrenade {
  sprite: THREE.Sprite
  private pulseTime = 0
  private baseSize: number

  constructor(
    scene: THREE.Scene,
    public worldX: number,
    public worldY: number,
    public damage: number,
    public aoeRadius: number,
    public side: 'attacker' | 'defender',
    public ownerId: string,
    baseSize = 16,
  ) {
    this.baseSize = baseSize
    const tex = getGrenadeTexture()
    const mat = new THREE.SpriteMaterial({
      map: tex ?? null,
      color: tex ? 0xffffff : 0xff5500,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      alphaTest: 0.1,
    })
    this.sprite = new THREE.Sprite(mat)
    this.sprite.scale.set(baseSize, baseSize, 1)
    this.sprite.position.set(worldX, worldY, 1.4)
    this.sprite.renderOrder = 11
    scene.add(this.sprite)
  }

  update(delta: number) {
    this.pulseTime += delta
    // ~2 Hz pulse ±15% to signal "armed and waiting".
    const k = 1 + 0.15 * Math.sin(this.pulseTime * Math.PI * 4)
    const s = this.baseSize * k
    this.sprite.scale.set(s, s, 1)
  }

  dispose() {
    this.sprite.removeFromParent()
    this.sprite.material.dispose()
  }
}
