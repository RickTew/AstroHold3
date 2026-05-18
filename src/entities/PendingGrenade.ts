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

  // armed=false: bomb just landed, can't trigger this turn (gives enemies
  // a planning window). RevealPhase.onComplete flips this to true at end
  // of turn. armed=true: live proximity trigger.
  armed = false

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
      // Yellow tint while unarmed, white when armed. Without a texture
      // (preload race) fall back to orange so it's still visible.
      color: tex ? 0xffe066 : 0xff5500,
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

  arm() {
    if (this.armed) return
    this.armed = true
    this.sprite.material.color.setHex(0xffffff)
  }

  update(delta: number) {
    this.pulseTime += delta
    // Unarmed: gentle pulse. Armed: faster, slightly stronger pulse to read
    // as "live threat".
    const freq = this.armed ? 6 : 3
    const amp = this.armed ? 0.18 : 0.1
    const k = 1 + amp * Math.sin(this.pulseTime * Math.PI * freq)
    const s = this.baseSize * k
    this.sprite.scale.set(s, s, 1)
  }

  dispose() {
    this.sprite.removeFromParent()
    this.sprite.material.dispose()
  }
}
