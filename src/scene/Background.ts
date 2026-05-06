import * as THREE from 'three'
import { Config } from '../game/GameConfig'

export class Background {
  private group: THREE.Group

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.buildGround()
    this.buildTerrainDetail()
    this.buildZoneOverlays()
    scene.add(this.group)
  }

  private buildGround() {
    const geo = new THREE.PlaneGeometry(1400, 600)
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1410 })
    const plane = new THREE.Mesh(geo, mat)
    plane.position.z = -6
    this.group.add(plane)
  }

  private buildTerrainDetail() {
    const patches: Array<{ x: number; y: number; w: number; h: number; color: number }> = [
      { x: -520, y:  100, w:  90, h: 60, color: 0x221a14 },
      { x: -300, y:  -80, w: 130, h: 45, color: 0x0e0c09 },
      { x:  -80, y:   70, w: 200, h: 80, color: 0x1e1812 },
      { x:  260, y: -120, w: 110, h: 55, color: 0x231b13 },
      { x:  450, y:   80, w:  90, h: 70, color: 0x0e0c09 },
      { x: -100, y: -150, w: 150, h: 50, color: 0x201810 },
      { x:  320, y:  140, w:  80, h: 45, color: 0x1a1208 },
      { x: -400, y: -100, w:  65, h: 90, color: 0x0c0a07 },
      { x:  150, y:   60, w:  70, h: 60, color: 0x181410 },
      { x: -200, y:  120, w: 110, h: 50, color: 0x120f0b },
      { x:   50, y: -170, w:  90, h: 40, color: 0x161210 },
      { x: -480, y:  -60, w:  50, h: 75, color: 0x1c1610 },
    ]
    for (const p of patches) {
      const geo = new THREE.PlaneGeometry(p.w, p.h)
      const mat = new THREE.MeshBasicMaterial({ color: p.color })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(p.x, p.y, -5.5)
      this.group.add(mesh)
    }
  }

  private buildZoneOverlays() {
    const H = Config.WORLD.TOP - Config.WORLD.BOTTOM

    const defMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(400, H),
      new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.4 })
    )
    defMesh.position.set(-400, 0, -4)
    this.group.add(defMesh)

    const attMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(400, H),
      new THREE.MeshBasicMaterial({ color: 0x1a0008, transparent: true, opacity: 0.4 })
    )
    attMesh.position.set(400, 0, -4)
    this.group.add(attMesh)

    const lineMat = new THREE.LineBasicMaterial({ color: 0x2a4a66 })
    const mkLine = (pts: THREE.Vector3[]) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat)

    this.group.add(mkLine([
      new THREE.Vector3(-200, Config.WORLD.BOTTOM, -3),
      new THREE.Vector3(-200, Config.WORLD.TOP, -3),
    ]))
    this.group.add(mkLine([
      new THREE.Vector3(200, Config.WORLD.BOTTOM, -3),
      new THREE.Vector3(200, Config.WORLD.TOP, -3),
    ]))
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry.dispose()
        const m = obj.material
        if (Array.isArray(m)) m.forEach(x => x.dispose())
        else m.dispose()
      }
    })
  }
}
