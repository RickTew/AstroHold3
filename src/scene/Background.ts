import * as THREE from 'three'

export class Background {
  private group: THREE.Group

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.buildStarfield()
    this.buildZoneOverlays()
    scene.add(this.group)
  }

  private buildStarfield() {
    const count = 300
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 1200
      positions[i * 3 + 1] = (Math.random() - 0.5) * 700
      positions[i * 3 + 2] = -5
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false })
    this.group.add(new THREE.Points(geo, mat))
  }

  private buildZoneOverlays() {
    // Defender zone — blue tint
    const defMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 700),
      new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.35 })
    )
    defMesh.position.set(-400, 0, -4)
    this.group.add(defMesh)

    // Attacker zone — red tint
    const attMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 700),
      new THREE.MeshBasicMaterial({ color: 0x1a0008, transparent: true, opacity: 0.35 })
    )
    attMesh.position.set(400, 0, -4)
    this.group.add(attMesh)

    // Zone divider lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1a3a55 })
    const mkLine = (pts: THREE.Vector3[]) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat)

    this.group.add(mkLine([new THREE.Vector3(-200, -350, -3), new THREE.Vector3(-200, 350, -3)]))
    this.group.add(mkLine([new THREE.Vector3( 200, -350, -3), new THREE.Vector3( 200, 350, -3)]))
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
