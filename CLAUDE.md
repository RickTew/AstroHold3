# AstroHold — Project Rules for Claude

## Stack (locked)
- Package manager: pnpm
- Bundler: Vite 8 (Rolldown inside)
- Renderer: Three.js r184
- Language: TypeScript 6 (strict)
- Linting: Biome (when added)

## File conventions
- All static assets (GLBs, textures, audio) go in `/public/` — loaded via absolute paths like `/models/cyborg/idle.glb`
- Shaders go in `/src/shaders/` as `.vert`/`.frag` — add `vite-plugin-glsl` when first shader is written
- Zip archives go in `/_zips/`

## Key constants to know
- World: x -600 to 600, y -350 to 350
- Defender zone: x < -200 | Attacker zone: x > 200 | Battlefield: middle
- Power Core at (-550, 0)
- Grid cell: 50×50 in defender zone (8 cols × 14 rows)
- Start credits: 200

## Models
- Cyborg (attacker units): `/public/models/cyborg/` — idle, running, dead, hit, walking, kick
- Sphere: `/public/models/sphere.glb` — 57MB, too large for dev; use Three.js geometry until compressed
- `MODEL_SCALE` and `MODEL_TILT_X` in `src/entities/Unit.ts` are the first things to tweak when model size/orientation is wrong
- New models: create → add to `/public/models/` → playtest → exhaust improvements → then add next model

## Architecture
- `GameConfig.ts` — all constants, change numbers here first before touching logic
- `Game.ts` — scene, camera, renderer, state machine (loading → build → battle → win/lose)
- `BuildPhase.ts` — grid placement, mouse events (cleanup() removes listeners)
- `BattlePhase.ts` — turn-based: unit acts → structure acts, alternating, TURN_INTERVAL controls speed
- `HUD.ts` — DOM overlay only, no Three.js
- HMR dispose is wired in `main.ts` + `Game.ts` — do not remove it

## Rules
- Don't hardcode rules or patterns that don't match our actual build — verify before committing
- Prefer pragmatic/working over theoretically correct
- Check if a tool/plugin is actually useful for this project before adding it
- `vite-plugin-gltf` is installed but inactive until GLBs are imported (not just URL-loaded from /public)
- No test files yet — add Vitest only when there's logic worth testing
