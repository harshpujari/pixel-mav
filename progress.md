# Pixel Mav - Build Progress

Track what's done, what's in progress, and what's next.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 1 — Project Scaffold
- [ ] Init VS Code extension (package.json, tsconfig, esbuild)
- [ ] Init webview (Vite + React + TypeScript)
- [ ] Wire up WebviewViewProvider (extension ↔ webview postMessage)
- [ ] Dev workflow: `npm run dev` + F5 launch

---

## Phase 2 — Game Loop & Canvas
- [ ] Mount `<canvas>` in webview
- [ ] RAF game loop with delta time cap
- [ ] Camera: pan (middle-drag), zoom (scroll), follow lerp
- [ ] `imageSmoothingEnabled = false` for crisp pixels

---

## Phase 3 — ECS Foundation
- [ ] Entity ID generator
- [ ] Component storage (Map per component type)
- [ ] System runner (ordered, per-frame)
- [ ] Basic components: Position, Sprite, Movement, Animation, Agent, Behavior

---

## Phase 4 — Sprite System
- [ ] Load PNG sprites from assets/
- [ ] Sprite atlas packer (`generate-atlas.ts`)
- [ ] Atlas lookup by key + frame rect
- [ ] Per-zoom atlas cache (1x–10x)
- [ ] HSL colorization for fur tint variation

---

## Phase 5 — Tile Map & Environment
- [ ] 2D tile grid (VOID / FLOOR / WALL / SUNNY)
- [ ] Floor tile rendering (colorizable patterns)
- [ ] Wall auto-tiling (4-bit bitmask → 16 variants)
- [ ] Dirty-region chunk tracking (8×8 chunks)
- [ ] Walkability + blocked tile map

---

## Phase 6 — First Cat on Screen
- [ ] One breed (Tabby), one direction (Down), idle frame
- [ ] SpriteComponent + PositionComponent rendering
- [ ] Walk animation (frames [1,2,3,2] at 0.15s/frame)
- [ ] All 4 directions + left-flip from right row

---

## Phase 7 — Pathfinding
- [ ] NavGrid with per-tile costs (Float32Array)
- [ ] A\* implementation (8-connected, √2 diagonal cost)
- [ ] Path smoothing (remove redundant waypoints)
- [ ] MovementSystem: interpolate position along path
- [ ] PathfindingSystem: run A\* on behavior request

---

## Phase 8 — Behavior Trees
- [ ] BT engine: Selector, Sequence, WeightedRandom, Decorator, Leaf nodes
- [ ] Per-entity blackboard (Map<string, unknown>)
- [ ] `catIdle.ts`: Sleep, Groom, Stretch behaviors
- [ ] `catWander.ts`: Prowl, Zoomies
- [ ] `catActive.ts`: Type, Read, Wait (permission)
- [ ] `catSocial.ts`: NapPile, Play, Headbonk (multi-cat)
- [ ] BehaviorSystem: evaluate tree each frame

---

## Phase 9 — Agent State Detection
- [ ] Locate Claude Code JSONL files (`~/.claude/projects/<hash>/<uuid>.jsonl`)
- [ ] `transcriptWatcher.ts`: fs.watch + fs.watchFile fallback + partial-line buffer
- [ ] `transcriptParser.ts`: JSONL → typed events (tool_start, tool_done, turn_end)
- [ ] `stateReconciler.ts`: 200ms event buffer → clean AgentState
- [ ] Tool → animation mapping (Read/Grep → reading, Write/Bash → typing)

---

## Phase 10 — IPC & Agent Lifecycle
- [ ] `agentManager.ts`: terminal spawn/dispose, JSONL file polling
- [ ] Extension → Webview messages: catSpawned, catDespawned, agentActive, agentIdle, agentPermission
- [ ] Webview → Extension messages: spawnClaude, focusCat, closeCat, saveCatSeats
- [ ] `ActivitySystem`: translate agentActive/agentIdle into behavior tree signals
- [ ] Sub-agent support (Task tool → child cat, negative entity IDs)

---

## Phase 11 — All Breeds & Animations
- [ ] All 6 breeds: Tabby, Tuxedo, Calico, Siamese, Void, Orange
- [ ] Hue shift for agents beyond 6
- [ ] Full animation set per breed: Sleep, Groom, Stretch, Zoomies, Pounce
- [ ] Random blink overlay on idle/read frames
- [ ] Sitting offset (6px down when at desk)

---

## Phase 12 — Spawn & Despawn Effects
- [ ] Spawn: poof particle burst + fade in (0.4s)
- [ ] Despawn: yawn → curl → fade out (0.5s) + paw-print particles
- [ ] `effectRenderer.ts`: particle system (position, velocity, lifetime, alpha)
- [ ] Restored agents skip spawn effect

---

## Phase 13 — Furniture & Environment
- [ ] `furnitureCatalog.ts`: cat furniture definitions (bed, tree, scratching post, toys, food bowl…)
- [ ] Furniture rendering with Z-sort
- [ ] Rotation variants (front/back/left/right)
- [ ] Toggle states (on/off for electronics)
- [ ] Seat positions derived from furniture placement
- [ ] Surface placement (items on desks)

---

## Phase 14 — Layout Editor
- [ ] Editor mode toggle (toolbar button)
- [ ] Tools: Select, Floor Paint, Wall Paint, Erase, Place Furniture, Eyedropper
- [ ] Ghost preview (valid = green tint, invalid = red tint)
- [ ] Grid expansion (click ghost border tile)
- [ ] 50-level undo/redo (layout snapshots)
- [ ] Keyboard shortcuts: Ctrl+Z/Y, R (rotate), T (toggle), Esc
- [ ] Right-click erase
- [ ] Color picker for floor/wall HSL tint
- [ ] `EditorToolbar.tsx` component

---

## Phase 15 — Layout Persistence
- [ ] Versioned layout JSON format (with migration system)
- [ ] Save to `~/.pixel-mav/layout.json`
- [ ] Load on startup, import/export via file dialog
- [ ] File watcher for cross-window sync
- [ ] Agent seat assignments persisted to workspace state

---

## Phase 16 — UI Polish
- [ ] Bottom toolbar: +Cat, Layout, Settings buttons
- [ ] Zoom controls (±, reset)
- [ ] CatBadge: activity label above cat (tool name)
- [ ] Speech bubbles (permission request, wait state)
- [ ] Settings modal: import/export layout, sound toggle
- [ ] DebugOverlay: FPS, entity count, path viz (dev only)

---

## Phase 17 — Audio
- [ ] Web Audio API setup + context lifecycle
- [ ] Sounds: mew (spawn), purr (idle), chime (turn complete)
- [ ] Sound toggle (persisted to global state)
- [ ] Volume control

---

## Phase 18 — Tests
- [ ] Vitest unit tests: ECS world, A\*, behavior tree, state reconciler
- [ ] Playwright integration test: extension activate → cat spawns

---

## Phase 19 — Release Polish
- [ ] README with screenshots/GIF
- [ ] VS Code marketplace metadata (icon, description, categories)
- [ ] `vsce package` build passes
- [ ] Performance profiling (60 FPS with 20 cats confirmed)
- [ ] Cross-platform testing (macOS, Windows, Linux)
