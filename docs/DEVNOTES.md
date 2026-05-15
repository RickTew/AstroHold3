# AstroHold — Dev Strategies & Reference Notes

These are evaluated strategies and tool notes collected during development.
Status: HOLD = don't add yet | ACTIVE = in use | FUTURE = add when the need arrives

---

## Asset Loading

### /public folder for static assets (ACTIVE)
Put all `.glb`, `.jpg`, `.mp3` in `/public/`. Load with absolute paths:
```ts
loader.load('/models/cyborg/idle.glb')  // correct
loader.load('../../assets/model.glb')   // never this
```
Benefit: zero-config paths, no broken relative imports as files move.

### vite-plugin-gltf — build-time GLB compression (HOLD → FUTURE)
Installed. Works on *imported* GLBs (not /public URL strings).
Apply Draco + Meshoptimizer compression at build time.
Activate when: we want to optimize for production OR move models to `/src/assets/` imports.
Note: 57MB sphere needs compression before use. Cyborg files ~7MB each are fine for dev.
```ts
// vite.config.ts — when ready
import gltf from 'vite-plugin-gltf'
import { draco } from '@gltf-transform/functions'
plugins: [gltf({ transforms: [draco()] })]
```

---

## Shaders

### vite-plugin-glsl — shader HMR without losing game state (HOLD → FUTURE)
Separate `.vert`/`.frag` files hot-reload without full page refresh.
You keep camera position and game state while tweaking shader code.
Activate when: first custom GLSL shader is written.
```ts
import glsl from 'vite-plugin-glsl'
plugins: [glsl()]
```
Put shader files in `/src/shaders/`. Never inline GLSL strings in `.ts` files.

---

## Vite / HMR

### Avoiding double-init on HMR (ACTIVE)
Vite can re-run `main.ts` without unloading the previous module — two renderers on one canvas.
Fix: `import.meta.hot.dispose()` in `main.ts` + `game.dispose()` stops RAF loop, clears scene.
Already wired. Do not remove.

### Recommended vite.config.ts settings (ACTIVE)
- `target: 'esnext'` — no transpilation needed, Three.js r182+ expects it
- `assetsInlineLimit: 0` — never base64-encode assets (breaks GLB URL loading)
- `manualChunks: { three: ['three'] }` — Three.js (~600KB) cached separately from game code
- `host: true` — reach dev server from phone/tablet on local network

---

## 2026 Tool Landscape (reference)

| Tool | Version | Status | Notes |
|---|---|---|---|
| pnpm | 10.x | ACTIVE | 30% faster than npm, better disk usage |
| Vite | 8.0 | ACTIVE | Rolldown bundler inside, 10-30x faster builds |
| Three.js | r184 | ACTIVE | WebGPU renderer available but we use WebGL 2 |
| TypeScript | 6.0 | ACTIVE | 7.0 (Go rewrite) still beta — stay on 6 for now |
| Biome | 1.x | FUTURE | Replaces ESLint+Prettier, 10-25x faster — add when linting is needed |
| Vitest | 4.x | FUTURE | Add when there's logic worth unit testing |
| vite-plugin-gltf | 4.0 | INSTALLED/INACTIVE | Need to activate for production optimization |
| vite-plugin-glsl | — | FUTURE | Add when writing first GLSL shader |
| theatre.js | — | FUTURE | Cinematic animation sequencing — add if we do cutscenes |
| leva | — | FUTURE | Live parameter tweaking GUI — useful for tuning game constants |

---

## Model Workflow
1. Create model in Meshy → download GLB with animations
2. Unzip to `/_zips/`, extract to `/public/models/<name>/`
3. Use short filenames: `idle.glb`, `running.glb`, `dead.glb`, `hit.glb`
4. Set `MODEL_SCALE` in `Unit.ts` — Meshy models vary wildly in size
5. Playtest → exhaust all fixes/improvements on this model
6. Only then: add next model

---

## Camera Strategies & Troubleshooting

### Camera shake — ortho version (FUTURE / easy add)
3 lines in `Game.ts`, no manager class needed:
```ts
shake(intensity: number) {
  this.camera.position.x += (Math.random() - 0.5) * intensity
  this.camera.position.y += (Math.random() - 0.5) * intensity
}
```
Call `shake(8)` on big explosions, `shake(3)` on regular hits. Reset position toward (0,0,100) with lerp if drift becomes visible.

### Raycaster timing (WATCH IF camera ever moves)
Currently camera is static — order doesn't matter.
If camera lerping/movement is added: raycaster must be set *after* the camera has moved in that frame.
```ts
// Correct order in loop:
camera.position.lerp(target, 0.1)  // move first
raycaster.setFromCamera(mouse, camera)  // then raycast
```
Wrong order = clicks land in the wrong place by one frame.

### Logarithmic depth buffer — Z-fighting nuclear option
If textures start flickering at mixed depth ranges (Z-fighting):
```ts
// In Game.ts renderer setup:
this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true })
```
We currently prevent Z-fighting by assigning explicit Z values (starfield z=-5, grid z=0.3, entities z=0, HP bars z=0.1-0.2). Use the log buffer if manual Z management gets unwieldy.

### Ortho vs perspective in build mode
OrthographicCamera has zero perspective distortion by design — objects don't shrink with distance.
This is a free advantage for our build phase grid placement. No FOV tuning needed.

### Lerp smoothing for camera transitions
If adding camera pan/zoom:
```ts
// Smooth any value toward target
current = THREE.MathUtils.lerp(current, target, lerpFactor * delta * 60)
```
`lerpFactor` 0.05–0.15 = smooth, 0.3+ = snappy.

### HMR + singleton cameras — known trap
Static singleton cameras (`static instance`) survive Vite HMR and cause stale camera state.
Our pattern: `Game` instance is created fresh in `main.ts`, old one disposed via `import.meta.hot.dispose()`. No singleton needed.

---

## Current Build State (2026-05-06)
- Deployed at https://astrohold3.vercel.app
- World: ±600 x ±200, three ~400×400 zones
- Testing phase: both shops visible, attacker units spawn on button click
- Sphere.glb = power core (local only; SphereGeometry fallback on Vercel)
- Cyborg = attacker (running + dead animations, hit flash)
- Tuning knobs: `SPHERE_SCALE` in PowerCore.ts, `MODEL_SCALE` + `MODEL_TILT_X` in Unit.ts

---

## Common Errors & Fixes

### Resize distorts game — camera frustum not updated (WATCH)
The renderer size updates on resize but the OrthographicCamera frustum does NOT auto-update.
If window is resized, the scene will squish/stretch.
Fix — add to `onResize` in `Game.ts`:
```ts
private onResize = () => {
  this.renderer.setSize(window.innerWidth, window.innerHeight)
  // Ortho camera needs frustum refresh too:
  const aspect = window.innerWidth / window.innerHeight
  this.camera.left   = -600 * aspect
  this.camera.right  =  600 * aspect
  this.camera.updateProjectionMatrix()
}
```
Or lock to a fixed canvas size and don't handle resize at all — simpler for dev.

### Resize event guard — defensive check (ACTIVE pattern)
Before updating camera aspect or renderer size, guard against zero dimensions (can happen during HMR or rapid resizes):
```ts
const { innerWidth: w, innerHeight: h } = window
if (w === 0 || h === 0) return
```

### Grid snapping: Math.floor vs Math.round
`Math.floor` = origin-based snap (top-left of cell). This is what BuildPhase uses — correct for grid placement.
`Math.round` = center-based snap. Use this only if you want the cursor to snap to the nearest center rather than the cell the cursor is in.
Never mix them — one places structures half a cell off.

### HMR duplicate event listeners
All `window.addEventListener` calls must be cleaned up in `cleanup()` / `dispose()`.
Our pattern: BuildPhase registers `mousemove` + `click` in constructor, removes both in `cleanup()`. If cleanup is skipped (crash/HMR), listeners stack up and you get double-fire on every event.
Symptom: clicking places two structures, or ghost appears when no type is selected.

### Projectile fires but target is already dead
Design decision: damage is applied immediately when the structure fires (in `doStructureTurn`), not when the projectile lands. The flying projectile is visual only.
If a unit dies and vanishes before the projectile animation completes, that's correct behavior. Do not move damage to projectile `update()` — it will cause double-damage.

### Turn loop: all alive units act each tick (no index drift)
`executeTurn` filters `units.filter(u => !u.isDead)` and loops everyone in one go (no `unitIdx`). A unit that dies mid-loop won't be revisited this tick, won't be skipped next tick. Earlier sessions documented "unit-skip drift" — that bug is gone; the design is simpler now.

### Mines don't fire if unit spawns inside mine radius
`checkMines` is called before the unit moves on its first turn. If units spawn close to a mine (spawnX 420+, mines max at ~-200), this is not an issue. But if map changes and spawn zone moves, test mine trigger on first turn.

---

## Decisions Made & Why
- **No React / R3F** — vanilla Three.js keeps the build lean; R3F ecosystem is strong but adds React overhead for a non-UI-heavy game
- **Geometric placeholders** — structures use Three.js primitives so gameplay works before art is final
- **Sphere GLB on Vercel** — 57MB file IS tracked in git and deployed; SphereGeometry fallback only if file fails to load
- **Turn-based not real-time** — easier to balance and debug; speed controlled by `TURN_INTERVAL` in `BattlePhase.ts`
- **DOM overlay for HUD** — HTML/CSS is faster to iterate than Three.js UI; `pointer-events: none` on container with `auto` on children
- **Bottom bar flex layout** — single `#bottom-bar` div holds both shops + battle button; prevents any overlap at any window size

---

## Current Build State (2026-05-06, session 2)
- Deployed at https://astrohold3.vercel.app / GitHub: RickTew/AstroHold3
- World: ±600 x ±200, three ~400×400 zones, rocky planet terrain (canvas texture)

### Key tuning knobs (check these first after any crash)
- `MODEL_SCALE = 25` in `Unit.ts` — cyborg 1.65 units → ~41 world units tall
- `MODEL_TILT_X = 0` in `Unit.ts` — faces camera; if model appears face-down, try `Math.PI / 2`
- Sphere auto-scales in `PowerCore.ts` from bounding box; stored as `glbBaseScale` for pulse

### Animation gotcha — T-pose during build phase (FIXED)
`testUnits` are visible during the build phase but `battlePhase` is null, so `update()` was never called.
Fix: `this.testUnits.forEach(u => u.update(delta))` in Game.ts loop.
Symptom if this regresses: model appears frozen in T-pose (arms spread, no motion).

### What's working now
- Cyborg: idle.glb default, running.glb + dead.glb preloaded, hit flash
- Power Core: sphere.glb on Vercel, auto-scales, pulses using stored base scale
- Bottom bar: flex — defender left, battle center, attacker right — never overlaps
- Credits: defender top-left (blue), attacker top-right (red), both deduct on spend

### What to test / next up
1. Confirm idle animation plays (not T-pose)
2. Spawn attacker units, watch credits deduct
3. Place structures, hit BATTLE — check running/dead animations
4. Confirm sphere.glb loads and pulses (may take a moment — 57MB)

---

## Session 3 (2026-05-12) — Sphere placement bug + canonical placement flow

### Bug fixed: ghost shown but `sphereSelecting` stuck false
`onBuySphere` was setting `this.sphereSelecting = true` *before* calling `this.createSphereGhost()`. But `createSphereGhost` calls `this.clearSphereGhost()` defensively to wipe any stale mesh — and `clearSphereGhost` ALSO sets `sphereSelecting = false`. Net: the ghost appeared on screen, but the flag was already back to false, so every canvas click silently failed the `sphereSelecting && buildPhase` gate.

**Fix:** swap the order in `onBuySphere` — call `createSphereGhost()` first, then set `sphereSelecting = true`. Order matters because the helper resets the flag.

**Diagnosis tool:** an on-screen debug overlay (top-center) that prints mousedown state was added temporarily — it surfaced the impossible-looking `ssel=N, ghost.v=Y` combination immediately. Pattern worth reusing: when a placement / state-flag bug is invisible to inspection, route state into the HUD via `setDebug(msg)` and screenshot it. Removed after the fix.

### Pattern: helper-resets-state class of bug
Any "clear/reset" helper that also resets a coordination flag will silently undo flag changes made by its callers if called from within a `create` helper. **Watch for this any time a `createX` calls `clearX` internally** — `attGhost` happens to dodge this by not calling `clearAttPlacement` from `createAttGhost` (it only removes the mesh).

### Canonical placement flow (now in CLAUDE.md)
Cyborg and sphere now share the same 3-step pattern. The ghost mesh is the source of truth for placement position — never re-raycast at click time. See CLAUDE.md "Canonical placement flow" section.

### Visual upgrade
Defender zone gets a bright cyan tint (`0x00ddff @ 0.32` opacity) over (-600..-200, -200..200) when sphere selection mode is active — was previously invisible, so users couldn't tell where to click.

---

## Session 4 (2026-05-12) — Code cleanup + visual polish

### Unified placement state (one source of truth)
Previously: sphere had `sphereSelecting` + `sphereGhostMesh` + `spherePlaced` + `sphereZoneMesh`; cyborg had `selectedAttUnitType` + `attGhostMesh` + `attPendingCost`. Three different state machines for the same idea — pick a thing, hover ghost, click to place.

Now: a single `placement: PlacementSession | null` in `Game.ts`. Each session owns its own ghost mesh, optional zone tint, zone bounds, and an `onPlace(x, y) => boolean` callback (return `true` to end the session, e.g. one-shot sphere; `false` to stay in placement, e.g. multi-place cyborg). Starting a new session implicitly cancels the old one.

Killed: the "must call createSphereGhost before setting flag" gotcha — that whole class of bug becomes structurally impossible since helpers no longer mutate shared flags.

### Billboard HP bars
All HP bars (Unit, SphereDefender, PowerCore, Structure) are now wrapped in a `hpBarGroup` whose quaternion is copied from the camera each frame. Previously they used a fixed `rotation.x = -π/4` tilt that worked only at the default camera angle and broke under pan/zoom. Each entity exposes `faceCamera(camera)`; Game's render loop calls them after `update()`.

### Structure placement offset bug (FIXED)
`Structure.worldY` was hardcoded to `-350 + row * 50 + 25` even though `Config.WORLD.BOTTOM = -200`. Result: structures rendered 125 units south of where the user clicked. Replaced with `Config.WORLD.BOTTOM + row * GRID_CELL + GRID_CELL/2` (and same Config-derived form for `worldX`). Always derive grid coords from `Config.WORLD` — never re-magic-number the bounds.

### Permanent zone tints (symmetric)
Both sides now have a subtle permanent tint during build phase — defender cyan (`0x00ddff @ 0.07`), attacker red (`0xff4488 @ 0.07`). Placement adds a brighter tint *on top* of the permanent one. No more "where can I click?" confusion before pressing a Buy button.

### Sphere fallback: BasicMaterial + rings
Per CLAUDE.md, swapped fallback `MeshStandardMaterial` → `MeshBasicMaterial` so the placeholder doesn't render as a washed-out gray sphere under our scene lighting. Added two thin equatorial rings so the placeholder reads as "spherical object with structure" rather than "untextured ball." Only visible until `sphere.glb` (57MB) finishes downloading.

### Dead code removed
- `attPendingCost` — declared and read in `clearAttPlacement` but never assigned anywhere → useless "refund" code path
- `testUnits` → renamed to `attackerUnits` (they're real attacker units, not test fixtures)
- Removed `markSpherePurchased` is still called (single-shot sphere) but flag-spaghetti gates are gone

---

## Session 5 (2026-05-12) — Multi-sphere refactor BROKE sphere visuals; LIVE SITE IS BROKEN

### TL;DR for the next session
- **Live site (https://astrohold3.vercel.app) is currently broken.** Placed spheres render as oblate / squashed ellipsoids instead of round.
- Most likely cause: `loadSphereTemplate()` in `Game.ts` stores `gltf.scene` as a template, and `SphereDefender` constructor does `modelTemplate.clone(true)` per placement. Meshy GLB exports often contain `SkinnedMesh` + `Skeleton` metadata even when the rig add-on wasn't purchased. `Object3D.clone(true)` does NOT correctly clone skinned meshes — the clones share the original skeleton's bind matrices and render with broken transforms.
- The cyborg code already uses `SkeletonUtils.clone` (imported from `three/examples/jsm/utils/SkeletonUtils.js`) for exactly this reason.
- Most likely fix: replace `modelTemplate.clone(true)` in `SphereDefender.ts:21` with `SkeletonUtils.clone(modelTemplate)`. One-line change. **NOT VERIFIED.**
- Alternative: `git revert b5aef86 1ec6443` to roll back to last-known-good state (single-sphere singleton, GLB rendered correctly).

### What was attempted this session
1. **Unified placement state** (commit `1ec6443`) — replaced sphere/cyborg flag soup with a single `PlacementSession` in Game.ts. This part is independently fine and shouldn't be reverted just to fix the sphere visual.
2. **Billboard HP bars** — every entity (Unit, SphereDefender, PowerCore, Structure) gained a `faceCamera(camera)` method that copies the camera quaternion onto a `hpBarGroup`. Replaces fixed `rotation.x = -π/4` tilt.
3. **Structure offset fix** — `Structure.worldY` was hardcoded to `-350 + ...` instead of `Config.WORLD.BOTTOM + ...`; now uses Config. Independently a real bug fix.
4. **Permanent zone tints** — both sides get a subtle always-on tint during build phase.
5. **Multi-sphere refactor** (commit `b5aef86`) — Sphere is no longer a singleton. Game stores `sphereTemplate: THREE.Object3D` (loaded once, awaited) + `spheres: SphereDefender[]`. SphereDefender clones the template per instance. Sphere button stays enabled until credits run out.
6. **Awaited GLB load** — `init()` now waits for `sphere.glb` to fully load before showing the game, so the cyan fallback never appears during normal load.

### My mistakes this session (for honesty, so the next session reads from a clean slate)
- **Claimed PowerCore had no HP bar.** It did — I missed it on first read. Caught by re-reading the file before coding.
- **Listed structure verification steps in the verify-after-deploy list when there's no structure UI in HUD.** The Structure code path exists in `BuildPhase.ts` and `Structure.ts` but there are no shop buttons for turret/wall/cannon/mine yet. User correctly called this out.
- **Confidently asserted the sphere GLB is intrinsically oblate, without inspecting the asset.** User showed the Meshy preview of the GLB — it's a perfect round sphere. The warping is from my clone code, not the asset. This was the worst of the session and the reason the user lost trust. Memory written: see `feedback_dont_blame_asset.md`.
- **Pattern: I made multiple confident wrong claims in a row.** Each correction eroded trust further. The lesson is not "be less confident" — it's "verify before asserting, and after the first wrong claim in a session the bar for the next assertion should go up, not just hedge it." Memory written: see `feedback_dont_claim_works.md`.

### Repo state at session end
- Working tree clean
- Branch `main` is at `b5aef86` (multi-sphere refactor), pushed to GitHub
- Production deploy is on `b5aef86` — broken sphere visuals
- Pre-broken last-good commit: `f27a2a6` (or any commit before `1ec6443`)
- Files most relevant to the sphere-clone bug: `src/entities/SphereDefender.ts:21`, `src/game/Game.ts` `loadSphereTemplate`

### Suggested next-session opening moves
1. Decide direction: revert (`git revert b5aef86 1ec6443`) vs forward-fix (`SkeletonUtils.clone`)
2. If forward-fix: change `SphereDefender.ts:21` from `this.inner.add(modelTemplate.clone(true))` to use `SkeletonUtils.clone`, redeploy, playtest
3. If still warped after fix: inspect the GLB itself in a Three.js editor or `npx @gltf-transform/cli inspect public/models/sphere.glb` to see if there's non-uniform scale baked into nested children

---

## Session 6 (2026-05-15) — Sphere → pixel sprite; UX polish; remove cyan tints

### Major direction change: sphere is now a PIXEL SPRITE, not a 3D GLB
- 8 directional PNGs in `/public/sprites/sphere/` (~3 KB each, ~24 KB total) replace the 60 MB sphere.glb. ~3000× smaller payload, instant placement.
- `SphereDefender` uses `THREE.Sprite` with `NearestFilter` for crisp pixel scaling. `update(delta)` cycles through the 8 directions on a 0.4 s timer → ~3.2 s full spin.
- All GLB sphere infrastructure (loadSphereTemplate, makeSphereModel, sphereGlbBuffer, sphereScale, GLTFLoader import) gone from Game.ts.
- **Render flags that matter for sprite-on-3D-scene:**
  - `depthTest: false` so the sprite is never occluded by ground/fence depth. The billboard quad shares a single camera-space depth for all four corners, so depth failure was all-or-nothing (caused the entire sphere top to vanish when placed near the fence).
  - `depthWrite: false` so the sprite doesn't poison the buffer for later draws.
  - `alphaTest: 0.1` to discard fully transparent pixels for clean pixel-art edges.
  - `renderOrder: 10` so it sequences after ground/fence in transparent sort.

### Removed cyan/red zone tints → thin fence borders
- The semi-transparent tint planes were washing out sprite colors and creating "phantom edges" where they ended. Replaced with `makeZoneBorder()` LineSegments rectangle at z=0.4.
- Placement-time bright tint also dropped; the ghost ring at cursor is enough feedback.

### Cyborg model now Iron Arm Sentinel + merged animations format
- `/public/models/cyborg/character.glb` (mesh + skeleton) and `/public/models/cyborg/animations.glb` (13 clips, single file): Idle, Running, Walking, Dead, Hit_Reaction_1, Female_Crouch_Pick_Gun_Point_Forward, Rifle_Aim_Turn_Right, Run_and_Shoot, Forward_Roll_and_Fire, Gun_Hold_Left_Turn, Crouch_Pull_and_Throw, Crouch_Walk_with_Torch, Spartan_Kick.
- `Unit.preload()` now loads BOTH from `animations.glb` (using its `gltf.scene` as the character template too — separate character.glb had a different bind pose that caused Idle and Crouch_Pick_Gun to render distorted).
- Track filter strips `*.scale` (we set MODEL_SCALE) AND `Hips.position` (no root motion drift in test mode).
- **Known issue:** Meshy labeled the clips wrong inside the GLB — "Walking" plays the death animation, "Dead" plays hit reaction, etc. The DATA is correct; the NAMES are mislabeled by Meshy export. Either re-export with corrected labels, or add a name-remap table in Unit.ts. See `feedback_small_feedback_small_change.md` for related guidance.
- Test mode added: each cyborg drop cycles through ALL_ANIM_CLIPS via `getAllAnimClips()` (returns clip objects, not strings — bulletproof). Canvas-textured label above each cyborg shows the clip name being played.

### Camera/world simplifications
- Camera back to (0, 300, 300), 45° tilt — the known-good angle. Earlier in the session I tried straight top-down and a tilt-with-model-rotation; both were wrong. Reverted with memory `feedback_small_feedback_small_change.md`.
- Removed both grids (Game.ts ground grid + BuildPhase placement grid). The placement ghost ring is enough cell indicator. COLS/ROWS constants kept in BuildPhase for placement bounds checking only.

### Cyborg combat improvements
- `Unit.facingY` field persists across animation swaps so faceTarget rotations stick (swapAnim was resetting rotation.y to -π/2 every idle↔running, wiping faceTarget).
- `Unit.faceTarget(x, y)` called before each Projectile spawn in BattlePhase (sphere, structure, core engagements). Units visibly rotate to face their target.
- `Unit.getMuzzlePoint()` returns a point 22u in front of the unit. Projectiles spawn from there instead of (worldX, worldY + 20) → shots leave from the front, not the belly.
- Unit projectile color 0x00ccff → 0xff3333 (red). Sphere/structure/core projectiles keep their colors so you can tell who's shooting.

### Range balance
- Sphere range 200 → 300. Outranges scout (280), tank (200), bomber (160). Only drone (350, designed sniper) still outranges.

### UI polish
- HP bar bg 0x222222 → 0xcc2222 (red) on Unit, SphereDefender, PowerCore — damaged HP reads as red lost / green remaining.
- PowerCore rewritten as a chunky box + antenna spike + emissive edge wire (was octahedron+rings — looked too much like a sphere).
- PowerCore antenna repositioned to +Y world (was at +Z which projects DOWN on screen at our 45° tilt — looked upside down).
- `START_CREDITS` 200 → 1000 for testing. Tune down for production.
- Click on a placed sphere or cyborg during build phase → refund + remove. `tryRefund(x, y)` checks both arrays before falling through to placement logic. `BuildPhase.addCredits()` added for sphere refund path.
- Per-entity placement clamp: PlacementSession now carries marginTop/marginBottom. Sphere = 50/50 (sprite is symmetric ~90 tall). Cyborg = 45/20 (head extends ~40 above feet).

### Required model orientation (added to CLAUDE.md)
- New humanoid models need body axis +Y, front face +Z, origin at feet (standard Meshy/glTF). Documented in CLAUDE.md "Required model orientation" section.

### Repo state at session end
- Working tree clean, branch `main` at `d7ddcb7` (depth-test fix), production deployed.
- All recent commits on main, pushed to GitHub.
- Live: https://astrohold3.vercel.app

### Suggested next-session opening moves
1. **Sphere HP bar position.** Bar is at local (0, 55, 0), which after 45° camera projection puts it noticeably high *above* the sphere body, sometimes outside the fence when sphere is placed near the top. Either:
   - Lower the offset (e.g., local 35) so it sits closer to the sphere top
   - Or render HP bars at fixed screen distance using camera-space offset instead of world-space
2. **Cyborg animation naming.** Either re-export from Meshy with corrected labels, OR add a remap table in Unit.ts (`MESHY_NAME → ACTUAL_CONTENT_NAME`). Need user input to identify each clip's actual content visually.
3. **Wire `shoot` / `grenade` animation states.** Once names are correct, hook firing → "Female_Crouch_Pick_Gun_Point_Forward" or "Rifle_Aim_Turn_Right"; bomber → "Crouch_Pull_and_Throw". Brief play during projectile spawn.
4. **Consider pixel-sprite-ifying the cyborg** if the user wants to commit to the pixel-art aesthetic. PixelLab can render the cyborg at 8 directions per anim state, similar to the sphere. Would eliminate the Meshy labeling mess entirely.
