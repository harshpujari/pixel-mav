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

## Phase 4 — Agent State Detection
_The hardest backend piece — triple-layer JSONL watching for cross-platform reliability._

- [ ] Locate Claude Code JSONL files (`~/.claude/projects/<hash>/<id>.jsonl`)
- [ ] `transcriptWatcher.ts`: fs.watch + fs.watchFile + polling fallback
- [ ] Partial-line buffering for split reads
- [ ] `transcriptParser.ts`: JSONL → typed events (tool_use, tool_result, turn_duration)
- [ ] `stateReconciler.ts`: 200ms event buffer → clean AgentState (ACTIVE/WAITING/IDLE)
- [ ] Tool → cat state mapping (Write/Bash → type, Read/Grep → read, permission → wait)
- [ ] 5s silence fallback for idle detection
- [ ] Permission bubble trigger (7s after non-exempt tool start)

---

## Phase 5 — IPC + Agent Lifecycle
_Close the loop: Claude types → cat types. **This is the product.**_

- [ ] `agentManager.ts`: detect Claude Code terminals, track lifecycle
- [ ] Extension → Webview: `catSpawned`, `catDespawned`, `agentActive`, `agentIdle`, `agentPermission`
- [ ] Webview → Extension: `focusCat`, `closeCat`
- [ ] Webview message dispatcher → catStore updates
- [ ] Cat walks to seat when agent becomes active, sits and types/reads
- [ ] Cat returns to idle behaviors when agent becomes idle
- [ ] Sub-agent support (Task tool → child cat with negative ID suffix)
- [ ] `existingCats` message for webview reload recovery
- [ ] **Milestone: the core interaction loop works end-to-end**

---

## Phase 6 — Tile Map + BFS Pathfinding
_Replace placeholder grid with a real tile map. Cats walk real paths._

- [ ] 2D tile grid: VOID / FLOOR / WALL / SUNNY types
- [ ] Floor tile rendering (colorizable patterns)
- [ ] Wall auto-tiling (4-bit bitmask → 16 variants)
- [ ] Walkability check (tile type + blocked tiles from furniture)
- [ ] BFS pathfinding (4-connected, visited set, parent map)
- [ ] `movement.ts`: path following with `moveProgress` interpolation (3 tiles/sec)
- [ ] Walk animation plays during movement

---

## Phase 7 — Sprite System + First Breed
_Real cat sprites replace colored rectangles._

- [ ] PNG sprite sheet loading (Image → drawImage)
- [ ] `spriteData.ts`: frame rects, animation definitions per state
- [ ] `spriteCache.ts`: per-zoom cached canvases (WeakMap)
- [ ] First breed (Tabby): all 4 directions, all animation states
- [ ] Walk cycle: [1,2,3,2] at 0.15s/frame
- [ ] Type cycle: [5,6] at 0.25s/frame
- [ ] Read: [7] with blink overlay at 0.4s/frame
- [ ] Left-facing = horizontally flipped right row
- [ ] Sitting offset (+6px) when typing/reading at desk
- [ ] Z-sort by bottom-edge Y coordinate

---

## Phase 8 — Idle Behaviors
_The personality layer — what makes cats feel alive when Claude is idle._

- [ ] Sleep: curl up animation [S0,S1] at 0.8s/frame, Z bubble particles, 8-15s duration
- [ ] Groom: lick paw [G0,G1] at 0.5s/frame, 3-5s duration
- [ ] Stretch: big stretch + yawn [St0,St1] at 0.6s/frame, 2-3s duration
- [ ] Wander: BFS to random walkable tile (prefer SUNNY tiles), resume idle on arrival
- [ ] Zoomies: walk cycle at 0.08s/frame, 2× speed, 3-5s with multiple random targets
- [ ] Idle blink overlay (random 3-6s interval)
- [ ] 2s cooldown after agent goes idle before first idle behavior
- [ ] Interrupted by agent becoming active → walk to seat

---

## Phase 9 — Social Behaviors
_Multi-cat interactions that emerge from proximity._

- [ ] Proximity detection: find nearest cat within 3 tiles (every 3s)
- [ ] Nap Pile: if nearby cat sleeping → 30% chance → walk adjacent, sleep together
- [ ] Play: if nearby cat idle/wandering → 20% chance → chase sequence (both cats move)
- [ ] Headbonk: if nearby cat idle → walk over + bump animation, 2s
- [ ] Social cooldown per cat (prevent constant social attempts)
- [ ] Social behaviors interrupted by agent becoming active

---

## Phase 10 — All Breeds + Animations
- [ ] All 6 breeds: Tabby, Tuxedo, Calico, Siamese, Void, Orange
- [ ] Diverse palette picker (round-robin least-used breed)
- [ ] Hue shift (≥45°) for agents beyond 6
- [ ] Sub-agents inherit parent breed
- [ ] All animation states working per breed

---

## Phase 11 — Spawn/Despawn Effects
- [ ] `effectRenderer.ts`: particle system (position, velocity, lifetime, alpha)
- [ ] Spawn: particle burst (paw prints / sparkles) + cat fade in over 0.4s
- [ ] Despawn: yawn → curl → fade out over 0.5s + paw-print scatter
- [ ] Matrix effect for sub-agent spawn/despawn (green character rain)
- [ ] Restored agents skip spawn effect

---

## Phase 12 — Furniture + Environment
- [ ] `furnitureCatalog.ts`: furniture definitions (desk, cat bed, cat tree, toys, food bowl…)
- [ ] Furniture rendering with Z-sort interleaved with cats
- [ ] Blocked tiles from furniture footprints
- [ ] Seat positions derived from desk placement
- [ ] Rotation variants (front/back/left/right)
- [ ] Toggle states (electronics on/off, linked to agent activity)
- [ ] Default layout with desks + basic furniture

---

## Phase 13 — Layout Editor + Persistence
- [ ] Editor mode toggle (toolbar button)
- [ ] Tools: Select, Floor Paint, Wall Paint, Erase, Place Furniture, Eyedropper
- [ ] Ghost preview (valid = green, invalid = red)
- [ ] Grid expansion (click ghost border)
- [ ] 50-level undo/redo (layout snapshots)
- [ ] Keyboard: Ctrl+Z/Y, R (rotate), T (toggle), Esc
- [ ] Right-click erase, color picker for HSL tint
- [ ] `EditorToolbar.tsx` component
- [ ] Versioned layout JSON at `~/.pixel-mav/layout.json`
- [ ] Load on startup, file watcher for cross-window sync
- [ ] Agent seat assignments persisted to workspace state

---

## Phase 14 — UI Polish + Audio + Release
- [ ] Bottom toolbar: Layout, Settings buttons
- [ ] CatBadge: activity label above cat (tool name, truncated)
- [ ] Speech bubbles (permission request, waiting state with fade)
- [ ] Settings modal: import/export layout, sound toggle
- [ ] DebugOverlay: FPS, entity count, path viz (dev only)
- [ ] Web Audio: mew (spawn), purr (idle), chime (turn complete)
- [ ] Sound toggle + volume control (persisted)
- [ ] Vitest unit tests: stateMachine, BFS, stateReconciler
- [ ] README with screenshots/GIF
- [ ] VS Code marketplace metadata (icon, description, categories)
- [ ] `vsce package` build passes
- [ ] Performance profiling (60 FPS with 20 cats)
- [ ] Cross-platform testing (macOS, Windows, Linux)
