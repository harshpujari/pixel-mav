# Pixel Mav — Build Progress

Track what's done, what's in progress, and what's next.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

**Strategy:** Interaction-first. Get "Claude types → cat types" working ASAP, then layer behaviors and polish. Pragmatic implementation — simple Map, state machine, BFS — keeping the codebase simple and debuggable.

---

## Phase 1 — Project Scaffold ✓
- [x] Init VS Code extension (package.json, tsconfig, esbuild)
- [x] Init webview (Vite + React + TypeScript)
- [x] Wire up WebviewViewProvider (extension ↔ webview postMessage)
- [x] Dev workflow: `npm run dev` + F5 launch

---

## Phase 2 — Game Loop & Canvas ✓
- [x] Mount `<canvas>` in webview with container div
- [x] RAF game loop with delta time cap (seconds, first-frame guard)
- [x] Camera: pan (Ctrl+wheel zoom, plain wheel pan, middle-drag, alt+left-drag)
- [x] Zoom-toward-cursor with trackpad accumulator
- [x] Pan clamping (25% margin), follow lerp with snap threshold
- [x] Device-pixel rendering (no ctx.scale, manual offset+zoom)
- [x] Native wheel listener with `{ passive: false }` for webview
- [x] `imageSmoothingEnabled = false` for crisp pixels

---

## Phase 3 — Cat Entity + State Machine + First Rendering ✓
_Get one cat on screen with basic behaviors — proves the entity model works._

- [x] Define `Cat` interface (position, state, animation, agent binding) — `webview-ui/src/types.ts`
- [x] `catStore.ts`: `Map<string, Cat>`, add/remove/get/updateAllCats helpers + `makeCat` factory
- [x] `stateMachine.ts`: `updateCat(cat, dt, gridCols, gridRows)` — pure, no store/renderer imports
- [x] Implement core states: `idle`, `walk`, `type`, `read`, `wait`
- [x] Weighted random idle picker (sleep 40%, groom 20%, stretch 10%, wander 20%, zoomies 10%)
- [x] Render cat as colored rectangle placeholder (breed color + state dot + direction dot)
- [x] Cat renders on the placeholder grid, walks to random tiles (3 test cats spawned)

---

## Phase 4 — Agent State Detection ✓
_The hardest backend piece — triple-layer JSONL watching for cross-platform reliability._

- [x] Locate Claude Code JSONL files — `claudeProjectDir()` + `jsonlPath()` in `transcriptWatcher.ts`
- [x] `transcriptWatcher.ts`: fs.watch + fs.watchFile + polling fallback (triple-layer)
- [x] Partial-line buffering for split reads (buffer + split('\n') + keep incomplete tail)
- [x] `transcriptParser.ts`: JSONL → typed events (tool_start, tool_result, turn_end)
- [x] `stateReconciler.ts`: 200ms event buffer → clean ReconciledState (ACTIVE/WAITING/IDLE)
- [x] Tool → cat state mapping — `toolToCatState()` (Write/Bash → type, Read/Grep → read, AskUser → wait)
- [x] 5s silence fallback for idle detection (inactivity timer when no active tools)
- [x] Permission bubble trigger (7s after non-exempt tool start; Task/Agent/AskUser exempt)

---

## Phase 5 — IPC + Agent Lifecycle ✓
_Close the loop: Claude types → cat types. **This is the product.**_

- [x] `agentManager.ts`: detect Claude Code terminals, track lifecycle
- [x] Extension → Webview: `catSpawned`, `catDespawned`, `agentActive`, `agentIdle`, `agentPermission`
- [x] Webview → Extension: `focusCat`, `closeCat`
- [x] Webview message dispatcher → catStore updates
- [x] Cat walks to seat when agent becomes active, sits and types/reads
- [x] Cat returns to idle behaviors when agent becomes idle
- [x] Sub-agent support (Task tool → child cat with negative ID suffix)
- [x] `existingCats` message for webview reload recovery
- [x] **Milestone: the core interaction loop works end-to-end**

---

## Phase 6 — Tile Map + BFS Pathfinding ✓
_Replace placeholder grid with a real tile map. Cats walk real paths._

- [x] 2D tile grid: VOID / FLOOR / WALL / SUNNY types — `environment/types.ts`
- [x] Floor tile rendering (warm wood checkerboard + sunny golden overlay) — `engine/renderer/tileRenderer.ts`
- [x] Wall auto-tiling (4-bit bitmask → edge highlights on exposed sides) — `tileRenderer.ts` + `tileMap.ts:wallBitmask()`
- [x] Walkability check (tile type + optional blocked set) — `tileMap.ts:isWalkable()`
- [x] BFS pathfinding (4-connected, array-queue, bitwise keys) — `engine/pathfinding.ts`
- [x] `movement.ts`: path following with `moveProgress` interpolation (3 tiles/sec) — `engine/movement.ts`
- [x] Walk animation plays during movement (stateMachine uses BFS paths for wander/zoomies)
- [x] Cats spawn on walkable tiles, BFS-walk to seat on agent activation

---

## Phase 7 — Sprite System + First Breed ✓
_Real cat sprites replace colored rectangles._

- [x] Sprite sheet system (procedural bitmap → cached canvas → drawImage) — `spriteData.ts`, `spriteCache.ts`
- [x] `spriteData.ts`: frame bitmaps (10×12 string encoding), animation definitions, breed palettes, sheet layout (8×4)
- [x] `spriteCache.ts`: per-zoom cached HTMLCanvasElement frames with lazy invalidation
- [x] All 6 breeds with colour palettes (body/dark/light/eye/nose/earInner)
- [x] All 4 directions: down (8 frames), up (4), right (4), left = flipped right
- [x] Walk cycle: [1,2,3,2] at 0.15s/frame — 3 distinct walk poses per direction
- [x] Type cycle: [5,6] at 0.25s/frame — alternating paw extensions
- [x] Read: [7] with breed-coloured blink overlay at 0.4s/frame
- [x] Sit (wait state), sleep, groom, stretch — all with distinct bitmap poses
- [x] Left-facing = horizontally flipped right row (handled in spriteCache)
- [x] Sitting offset (+3 world px) when typing/reading/waiting at desk
- [x] Z-sort by bottom-edge Y coordinate (constant sprite height → y-sort equivalent)

---

## Phase 8 — Idle Behaviors ✓
_The personality layer — what makes cats feel alive when Claude is idle._

- [x] Sleep: curl up [S0,S1] at 0.8s/frame, Z bubbles, 8-15s — stateMachine + catRenderer `drawZzz()`
- [x] Groom: lick paw [G0,G1] at 0.5s/frame, 3-5s — stateMachine `toTimed()`
- [x] Stretch: [St0,St1] at 0.6s/frame, 2-3s — stateMachine `toTimed()`
- [x] Wander: BFS to random walkable tile (30% SUNNY preference), idle on arrival — Phase 6
- [x] Zoomies: walk cycle at 0.075s/frame, 2× speed, 3-5s multi-destination — Phase 6
- [x] Idle blink overlay (2.5-5s interval, 0.12s duration, down-facing only) — `blinkTimer` on Cat
- [x] 2s cooldown after agent goes idle — `AGENT_IDLE_COOLDOWN_SEC` in messageDispatcher
- [x] Interrupted by agent becoming active → BFS walk to seat — messageDispatcher `agentActive`

---

## Phase 9 — Social Behaviors ✓
_Multi-cat interactions that emerge from proximity._

- [x] Proximity detection: find nearest cat within 3 tiles (Manhattan distance) — `findNearbyCat()` in `stateMachine.ts`
- [x] Nap Pile: if nearby cat sleeping → 30% chance → walk adjacent, sleep together — `startNapPile()`
- [x] Play: if nearby cat idle/wandering → 20% chance → chase sequence (both cats move) — `startPlay()`
- [x] Headbonk: if nearby cat idle → walk over + bump animation, 2s — `startHeadbonk()`
- [x] Social cooldown per cat (15s full / 5s on failed attempt) — `SOCIAL_COOLDOWN_SEC`
- [x] Social behaviors interrupted by agent becoming active — existing `agentActive` handler overrides state

---

## Phase 10 — All Breeds + Animations ✓
- [x] All 6 breeds: Tabby, Tuxedo, Calico, Siamese, Void, Orange — `BREED_PALETTE` in `spriteData.ts`
- [x] Diverse palette picker (round-robin least-used breed) — `pickBreed()` in `agentManager.ts`
- [x] Hue shift (≥45°) for agents beyond 6 — `shiftHue()` + `getBreedColors()` in `spriteData.ts`, applied via `spriteCache.ts`
- [x] Sub-agents inherit parent breed — `spawnSubAgent()` copies parent breed + hueShift
- [x] All animation states working per breed — color index bitmaps resolve via breed palette

---

## Phase 11 — Spawn/Despawn Effects ✓
- [x] `effectRenderer.ts`: particle system (position, velocity, lifetime, alpha) — `engine/renderer/effectRenderer.ts`
- [x] Spawn: sparkle burst + cat fade in over 0.4s — `emitSpawnEffect()` + `SPAWN_DURATION`
- [x] Despawn: stretch (yawn) → sleep (curl) → fade out over 0.5s + paw-print scatter — `emitDespawnEffect()` + `DESPAWN_DURATION`
- [x] Matrix effect for sub-agent spawn/despawn (green character rain) — `emitMatrix()` with per-column falling chars
- [x] Restored agents skip spawn effect — `existingCats` handler doesn't set `spawnEffect`

---

## Phase 12 — Furniture + Environment ✓
- [x] `furnitureCatalog.ts`: furniture definitions (desk, cat bed, food bowl, plant, bookshelf)
- [x] `furnitureStore.ts`: placed instances, blocked tiles, seat derivation, desk toggle
- [x] Furniture rendering with Z-sort interleaved with cats (`furnitureRenderer.ts` + unified Z-sort in `renderer.ts`)
- [x] Blocked tiles from furniture footprints (threaded through stateMachine, pathfinding, randomWalkableTile)
- [x] Seat positions derived from desk placement (seatOffset + rotation support)
- [x] Rotation variants (0/1/2/3 in PlacedFurniture, w/h swap + seat offset rotation)
- [x] Toggle states (desk monitor on/off linked to agentActive/agentIdle/catDespawned)
- [x] Default layout: 8 desks matching DEFAULT_SEATS + 2 bookshelves + 2 plants + 2 cat beds + food bowl

---

## Phase 13 — Layout Editor + Persistence ✓
- [x] Editor mode toggle (E key or toolbar button) — `editor/editorState.ts`
- [x] Tools: Select, Floor, Wall, Sunny, Erase, Furniture, Eyedropper — `editor/editorActions.ts`
- [x] Ghost preview (green=valid, red=invalid, blue=expansion) — `editor/editorRenderer.ts`
- [x] Grid expansion (click ghost border tiles adjacent to grid edge) — `editorActions.ts:tryExpandGrid()`
- [x] 50-level undo/redo (full layout snapshots: tiles + furniture) — `editorActions.ts:undo()/redo()`
- [x] Keyboard: Ctrl+Z/Y (undo/redo), R (rotate), T (toggle active), Esc (deselect/exit), Del (delete), E (toggle editor)
- [x] Right-click erase (always erases regardless of current tool)
- [x] Click+drag tile painting (floor/wall/sunny/erase — single undo entry per drag)
- [x] `EditorToolbar.tsx` — React component with tool buttons, furniture palette, undo/redo, save
- [x] Versioned layout JSON (v1) at `~/.pixel-mav/layout.json` — `editor/layoutSerializer.ts`
- [x] Load on startup + file watcher for cross-window sync — `webviewProvider.ts`
- [x] `layoutLoaded` IPC handler re-validates cat positions on non-walkable tiles
- [x] Dashed selection outline on selected furniture, expansion ghost border around grid
- [x] Camera gridCols/gridRows auto-synced from tileMap each frame (supports grid resize)

---

## Phase 14 — UI Polish + Audio + Release
- [x] Bottom toolbar: Layout, Settings buttons
- [x] CatBadge: activity label above cat (tool name, truncated)
- [x] Speech bubbles (permission request, waiting state with fade)
- [x] Settings modal: import/export layout, sound toggle
- [x] DebugOverlay: FPS, entity count, path viz (dev only)
- [x] Web Audio: mew (spawn), purr (idle), chime (turn complete)
- [x] Sound toggle + volume control (persisted)
- [x] Vitest unit tests: stateMachine, BFS, stateReconciler
- [ ] README with screenshots/GIF
- [ ] VS Code marketplace metadata (icon, description, categories)
- [ ] `vsce package` build passes
- [ ] Performance profiling (60 FPS with 20 cats)
- [ ] Cross-platform testing (macOS, Windows, Linux)
