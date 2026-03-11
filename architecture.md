# Pixel Mav — Architecture

> A VS Code extension that brings Claude Code agents to life as animated pixel art cats in a cozy virtual space.

Each Claude Code terminal spawns a unique cat character that reacts in real-time — typing when the agent writes code, reading when it searches, napping when idle, and occasionally doing zoomies.

---

## Design Philosophy

Pixel-mav prioritizes **cat personality** — 12+ distinct states including sleep, groom, stretch, zoomies, and multi-cat social behaviors — while keeping the implementation pragmatic:

| Decision | Why |
|----------|-----|
| `Map<string, Cat>` not ECS | <50 entities. ECS adds indirection that doesn't pay off at this scale. |
| State machine not behavior trees | 11 states fit cleanly in a `switch`. BTs shine at 50+ composable behaviors. |
| BFS not A\* | Max grid 64×64 = 4096 tiles. BFS visits all of them in <1ms. A\* saves nothing. |
| Clear-and-redraw not dirty regions | Small canvas (<1000×600 device pixels). Full redraw at 60fps is trivially fast. |
| Manual offset+zoom not ctx transforms | Integer pixel alignment for crisp pixel art. No transform state bugs. |
| PNG sprite sheets not hex arrays | Editable in any pixel art editor. More maintainable than code-defined sprites. |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Extension     │  │ Agent        │  │ Transcript        │  │
│  │ Entry         │──│ Manager      │──│ Watcher           │  │
│  │ (activate)    │  │ (lifecycle)  │  │ (JSONL observer)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                 │                    │              │
│         │     ┌───────────┴────────────────────┘              │
│         │     │                                               │
│  ┌──────┴─────┴──┐  ┌──────────────┐                        │
│  │ Webview        │  │ Layout       │                        │
│  │ Provider       │──│ Persistence  │                        │
│  │ (IPC bridge)   │  │ (versioned)  │                        │
│  └──────┬─────────┘  └──────────────┘                        │
│         │ postMessage                                         │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────┼───────────────────────────────────────────────────┐
│         ▼            Webview (React + Canvas)                │
│  ┌──────────────┐                                            │
│  │ Message       │                                           │
│  │ Dispatcher    │                                           │
│  └──────┬───────┘                                            │
│         │                                                    │
│  ┌──────┴───────────────────────────────────────────────┐    │
│  │                    Game Engine                         │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │   │
│  │  │ Game Loop   │  │ Cat Store  │  │ Renderer       │  │   │
│  │  │ (RAF + dt)  │──│ (Map<id,  │──│ (Canvas 2D,    │  │   │
│  │  │             │  │  Cat>)     │  │ offset+zoom)   │  │   │
│  │  └─────────────┘  └─────┬──────┘  └────────────────┘  │   │
│  │                         │                              │   │
│  │  ┌────────────┐  ┌──────┴──────┐  ┌────────────────┐  │   │
│  │  │ State      │  │ Pathfinding │  │ Sprite Cache   │  │   │
│  │  │ Machine    │  │ (BFS)       │  │ (per-zoom)     │  │   │
│  │  └────────────┘  └─────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ UI Layer   │  │ Editor       │  │ Zustand Store        │ │
│  │ (React)    │  │ (layout)     │  │ (UI state)           │ │
│  └────────────┘  └──────────────┘  └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The extension lives in two processes connected via `postMessage`:

- **Extension Host** — Node.js. Manages terminals, watches Claude Code's JSONL transcript files, detects agent state transitions, persists layouts.
- **Webview** — Browser sandbox. Runs the game engine (Canvas 2D), renders cats and the environment, handles user interaction.

---

## Project Structure

```
pixel-mav/
├── src/                              # Extension backend (TypeScript)
│   ├── extension.ts                  # Entry: activate(), deactivate()
│   ├── webviewProvider.ts            # WebviewViewProvider, IPC bridge
│   ├── agentManager.ts              # Terminal lifecycle, agent spawn/despawn
│   ├── transcriptWatcher.ts         # JSONL file watching (triple-layer)
│   ├── transcriptParser.ts          # JSONL → typed agent events
│   ├── stateReconciler.ts           # Debounced events → clean state transitions
│   ├── layoutStore.ts               # Versioned layout persistence
│   ├── constants.ts
│   └── types.ts
│
├── webview-ui/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── store.ts                  # Zustand store (UI state)
│       ├── constants.ts
│       ├── vscodeApi.ts              # postMessage bridge
│       │
│       ├── engine/                   # Pure game engine (no React deps)
│       │   ├── gameLoop.ts          # RAF loop, delta cap, seconds
│       │   ├── catStore.ts          # Map<string, Cat>, add/remove/iterate
│       │   ├── stateMachine.ts      # State transitions, weighted random
│       │   ├── pathfinding.ts       # BFS on tile grid
│       │   ├── movement.ts          # Path following, pixel interpolation
│       │   └── renderer/
│       │       ├── renderer.ts      # Main render orchestrator
│       │       ├── tileRenderer.ts  # Floor + wall rendering
│       │       ├── catRenderer.ts   # Cat sprite rendering, Z-sort
│       │       ├── effectRenderer.ts # Spawn/despawn particles
│       │       ├── uiRenderer.ts    # Speech bubbles, badges
│       │       └── camera.ts        # Pan, zoom, follow, offset
│       │
│       ├── sprites/
│       │   ├── spriteData.ts        # Frame rects, animation definitions
│       │   ├── spriteCache.ts       # Per-zoom cached canvases
│       │   └── colorize.ts          # HSL colorization for breeds
│       │
│       ├── environment/
│       │   ├── types.ts             # Layout, tile, furniture types
│       │   ├── tileMap.ts           # 2D tile grid, walkability
│       │   ├── furnitureCatalog.ts  # Cat furniture catalog
│       │   └── layoutSerializer.ts  # Layout ↔ JSON
│       │
│       ├── editor/
│       │   ├── editorState.ts       # Tool selection, undo/redo
│       │   ├── editorActions.ts     # Layout mutation functions
│       │   └── EditorToolbar.tsx
│       │
│       ├── components/
│       │   ├── GameCanvas.tsx       # Canvas, input handlers
│       │   ├── Toolbar.tsx          # Bottom bar
│       │   ├── SettingsModal.tsx
│       │   ├── CatBadge.tsx
│       │   └── DebugOverlay.tsx
│       │
│       └── audio/
│           ├── sounds.ts
│           └── audioManager.ts
│
├── assets/
│   ├── cats/                        # Breed sprite sheets (PNG)
│   ├── furniture/
│   ├── tiles/
│   └── effects/
│
├── scripts/
│   └── build.ts                     # esbuild (extension)
│
├── test/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── architecture.md
```

---

## Core Systems

### 1. Cat Entity Model

All cats are stored in a `Map<string, Cat>` — a flat interface with all state fields. No classes, no ECS. Simple and inspectable in the debugger.

```typescript
type CatState =
  | 'idle' | 'walk' | 'type' | 'read' | 'wait'    // core
  | 'sleep' | 'groom' | 'stretch'                   // idle behaviors
  | 'wander' | 'zoomies'                             // movement behaviors
  | 'nap_pile' | 'play' | 'headbonk';               // social behaviors

interface Cat {
  id: string;

  // Agent binding
  agentId: string | null;
  seatCol: number;
  seatRow: number;
  activeTool: string | null;
  isSubagent: boolean;
  parentAgentId: string | null;

  // Appearance
  breed: CatBreed;         // tabby | tuxedo | calico | siamese | void | orange
  hueShift: number;        // degrees, for >6 agents

  // Position (world pixels, not device pixels)
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;

  // State machine
  state: CatState;
  stateTimer: number;      // seconds in current state
  stateDuration: number;   // when to transition (for timed states)

  // Movement
  path: Vec2[];            // BFS waypoints
  moveProgress: number;    // 0-1 lerp between current and next tile
  speed: number;           // tiles per second

  // Animation
  direction: Direction;    // down | up | right (left = flipped right)
  frame: number;
  frameTimer: number;

  // Social
  socialCooldown: number;  // seconds until next social check

  // UI
  bubbleType: 'permission' | 'waiting' | null;
  bubbleTimer: number;

  // Effects
  spawnEffect: boolean;
  despawnEffect: boolean;
  effectTimer: number;
}
```

**Sub-agent support:** When Claude's Task tool spawns a sub-agent, it creates a cat with `isSubagent: true` and a negative numeric suffix on the ID. Sub-agents get the same breed as their parent. Seat is assigned to the closest free seat to the parent.

---

### 2. Cat State Machine & Behaviors

Cats use a finite state machine with weighted random transitions for idle behaviors. This replaces behavior trees — simpler, debuggable, and sufficient for ~12 states.

#### All States

| State | Trigger | Animation | Duration | Notes |
|-------|---------|-----------|----------|-------|
| `idle` | Default / between actions | Standing, occasional blink | 1-3s | Gateway state for all transitions |
| `walk` | Moving to destination | Trot cycle (4 frames) | Until arrival | Speed: 3 tiles/sec |
| `type` | Agent writing/editing code | Paws on keyboard (2 frames) | While tool active | Sits at desk, +6px offset |
| `read` | Agent reading/searching | Eyes scanning, ear twitch | While tool active | Sits at desk, +6px offset |
| `wait` | Agent needs permission | Look around impatiently | While waiting | Bubble overlay after 7s |
| `sleep` | Idle behavior (40%) | Curled up, Z bubbles | 8-15s | Min duration enforced |
| `groom` | Idle behavior (20%) | Lick paw (2 frames) | 3-5s | |
| `stretch` | Idle behavior (10%) | Big stretch + yawn | 2-3s | |
| `wander` | Idle behavior (20%) | Walk to random tile | Until arrival | Uses BFS, picks walkable tile |
| `zoomies` | Idle behavior (10%) | Fast trot (2x speed) | 3-5s | Multiple random destinations |
| `nap_pile` | Nearby cat sleeping | Sleep next to them | 8-15s | Social: proximity check |
| `play` | Nearby cat idle/wandering | Chase sequence | 3-5s | Social: both cats move |
| `headbonk` | Nearby cat idle | Walk over + bump anim | 2s | Social: one-sided approach |

#### Transition Logic

```
Agent becomes ACTIVE (tool started):
  → If not at seat: state = walk, path = BFS(current → seat)
  → If at seat: state = type / read / wait (based on tool)

Agent becomes IDLE (turn ended):
  → state = idle, start 2s cooldown
  → After cooldown, weighted random pick:
      sleep(40%) / groom(20%) / stretch(10%) / wander(20%) / zoomies(10%)

Social check (every 3s while in idle/sleep/groom/stretch):
  → Find nearest cat within 3 tiles
  → If nearby cat sleeping → 30% chance → nap_pile
  → If nearby cat idle/wandering → 20% chance → play or headbonk

Current timed behavior finishes (stateTimer >= stateDuration):
  → state = idle, pick new idle duration (1-3s)

Agent becomes ACTIVE during any idle/social behavior:
  → Interrupt immediately → walk to seat → work state

Walk path completed:
  → If was heading to seat AND agent active → type / read / wait
  → If was wandering → idle
  → If was doing zoomies AND time remains → pick new random destination
  → Otherwise → idle
```

#### Tool → Animation Mapping

| Tools | Cat State | Visual |
|-------|-----------|--------|
| Write, Edit, Bash, Task, NotebookEdit | `type` | Paws batting keyboard |
| Read, Grep, Glob, WebFetch, WebSearch | `read` | Eyes scanning, tail flick |
| AskUserQuestion / permission prompt | `wait` | Impatient look-around |

---

### 3. BFS Pathfinding

Simple breadth-first search on a 4-connected tile grid.

```typescript
function findPath(
  startCol: number, startRow: number,
  endCol: number, endRow: number,
  tileMap: TileMap,
  blockedTiles: Set<string>,
): Vec2[] {
  // Standard BFS with visited set and parent map
  // 4 directions: up, down, left, right (no diagonals)
  // Returns path excluding start, including end
  // Empty array if no path found
}
```

- **Walkability:** tile is walkable if not WALL, not VOID, and not in blockedTiles set
- **Blocked tiles:** built from furniture footprints, temporarily unblocked for own seat
- **Movement speed:** 48 px/sec ÷ 16 px/tile = 3 tiles/sec (6 tiles/sec for zoomies)
- **Interpolation:** `moveProgress` (0→1) lerps between tile centers each frame

---

### 4. Agent State Detection

The extension watches Claude Code's JSONL transcript files to detect what each agent is doing.

```
JSONL record
    │
    ▼
TranscriptParser        # Parse raw JSONL → typed events
    │                     - type: 'assistant' with tool_use blocks
    │                     - type: 'user' with tool_result blocks
    │                     - type: 'system', subtype: 'turn_duration'
    ▼
StateReconciler         # 200ms event buffer → clean AgentState
    │                     - Coalesce rapid tool start/stop
    │                     - Track active tool IDs + names
    │                     - Use turn_duration as authoritative end signal
    │                     - 5s silence fallback for idle detection
    ▼
AgentState              # ACTIVE(tool) | WAITING | IDLE
    │
    ▼
postMessage → Webview   # Single clean update per reconciliation cycle
```

**File watching strategy (triple-layer for cross-platform reliability):**
1. `fs.watch()` — event-driven (fast but unreliable on macOS)
2. `fs.watchFile()` — stat-based polling every 1s (reliable fallback)
3. Manual polling interval — 1s safety net

All three run simultaneously. First change triggers read. Partial-line buffering handles records split across reads.

**Permission bubbles:** Shown 7 seconds after a non-exempt tool starts (exempt: Task, AskUserQuestion). Cleared when new data arrives or tool completes.

**Waiting state:** Triggered by `turn_duration` record (definitive turn end) or 5 seconds of silence if no tools were used in the turn.

---

### 5. Rendering

Canvas 2D with full clear-and-redraw each frame. No dirty regions, no ctx transforms.

```
Each frame:
1. Clear entire canvas (device pixels)
2. Camera: update follow lerp → compute offset
3. Draw floor tiles (visible range only)
4. Draw wall tiles
5. Collect visible entities (cats + furniture)
6. Z-sort by bottom-edge Y coordinate
7. Draw entities from sprite cache
8. Draw effects (spawn/despawn particles)
9. Draw UI overlays (bubbles, badges)
```

**Coordinate system:**
- All rendering in device pixels (canvas.width × canvas.height)
- No `ctx.scale(dpr)` — multiply manually for crisp integer alignment
- Position: `drawX = offsetX + worldX * zoom`, `drawY = offsetY + worldY * zoom`
- Font sizes: `desiredCSSSize * dpr`

**Sprite cache:** Per-zoom `WeakMap<ImageBitmap, OffscreenCanvas>`. Each sprite pre-scaled to the current zoom level once, then drawn via `ctx.drawImage()` for the rest of the frame. Cache invalidated only when zoom changes.

**Z-sorting:** All drawables (cats, furniture, wall tops) have `zY = bottomEdgeY`. Sort ascending, draw in order. Cats sitting at desks get +6px offset for visual sitting position (does not affect zY).

---

### 6. Cat Sprites

**Sprite dimensions:** 16×24 pixels per frame (taller than tile for natural cat proportions).

**Sprite sheet layout** (per breed PNG, 128×96):

```
Row 0 (Down):    idle | walk1 | walk2 | walk3 | sit | type1 | type2 | read
Row 1 (Up):      idle | walk1 | walk2 | walk3 | sit | type1 | type2 | read
Row 2 (Right):   idle | walk1 | walk2 | walk3 | sit | type1 | type2 | read
Row 3 (Special): sleep1 | sleep2 | groom1 | groom2 | stretch1 | stretch2 | zoomies | pounce
```

Left-facing = horizontally flipped right row at runtime.

**6 breeds:** Tabby, Tuxedo, Calico, Siamese, Void (all-black), Orange.
Beyond 6 agents, breed repeats with a random hue shift (≥45°) for uniqueness.

| State | Frames | Speed | Notes |
|-------|--------|-------|-------|
| Idle | [0] | — | Occasional blink (random 3-6s interval) |
| Walk | [1,2,3,2] | 0.15s/frame | Trotting cycle |
| Type | [5,6] | 0.25s/frame | Paws batting keyboard |
| Read | [7] + blink | 0.4s/frame | Eyes scanning, tail flick |
| Sleep | [S0,S1] | 0.8s/frame | Curled up, Z bubbles above |
| Groom | [G0,G1] | 0.5s/frame | Lick paw |
| Stretch | [St0,St1] | 0.6s/frame | Stretch + yawn |
| Zoomies | [1,2,3,2] | 0.08s/frame | Walk cycle at 2× speed |

---

### 7. Environment & Furniture

**Tile types:**
- `VOID` — empty, non-walkable, transparent
- `FLOOR` — walkable, colorizable (wood, carpet, tile patterns)
- `WALL` — non-walkable, auto-tiled (4-bit bitmask → 16 variants)
- `SUNNY` — walkable, cats gravitate here during wander (not pathfinding cost — just preference in random tile selection)

**Cat-themed furniture:**

| Category | Items |
|----------|-------|
| Work | Tiny laptop, monitor, desk, keyboard |
| Comfort | Cat bed, cat tree, scratching post, window perch, heated pad |
| Food | Food bowl, water fountain, treat dispenser |
| Toys | Yarn ball, feather wand, laser dot, cardboard box |
| Decor | Plant, bookshelf, rug, window |

Default grid: 20×11 tiles (expandable to 64×64 in editor).

**Seat positions:** Derived from desk furniture placement. Each desk has a seat tile in front of it where cats sit to type/read.

---

### 8. Spawn & Despawn Effects

**Spawn:** Particle burst (paw prints / sparkles) + cat fades in over 0.4s. Optional "mew" sound.

**Despawn:** Cat yawns, curls up, fades out over 0.5s. Paw-print particles scatter outward.

**Matrix variant (sub-agents):** Green character rain effect with per-column stagger and flicker. Used for Task tool sub-agent spawn/despawn.

**Restored agents** (webview reloaded) skip the spawn effect — they just appear.

---

### 9. Layout Editor

Built into the webview, toggled via toolbar:

**Tools:** Select, Floor Paint, Wall Paint, Erase, Place Furniture, Eyedropper

**Features:**
- 50-level undo/redo (layout snapshots)
- Ghost border outside grid — click to expand
- Furniture placement preview (green = valid, red = invalid)
- Color picker for floor/wall HSL tint
- Right-click to erase
- Keyboard: Ctrl+Z/Y (undo/redo), R (rotate), T (toggle state), Esc

**Persistence:** Layouts saved as versioned JSON at `~/.pixel-mav/layout.json`, shared across VS Code windows. File watcher syncs changes between windows.

---

### 10. State Management

**Zustand store** — UI state that React subscribes to:
```typescript
interface PixelMavStore {
  agents: Map<string, AgentInfo>
  selectedCatId: string | null
  isEditorOpen: boolean
  soundEnabled: boolean
}
```

**Game state** — engine-internal `Map<string, Cat>`, never triggers React re-renders. Updated by `updateCat()` each frame.

**Bridge:** Zustand actions dispatch events into the engine (e.g. agent state changes from extension messages). The engine reads the store for agent data. Clean separation prevents React re-renders from blocking the game loop.

---

### 11. Message Protocol

**Extension → Webview:**

| Message | When |
|---------|------|
| `catSpawned` | Terminal created / Claude Code agent detected |
| `catDespawned` | Terminal closed |
| `agentActive` | Tool started (after reconciliation) |
| `agentIdle` | Turn ended / waiting for input |
| `agentPermission` | Waiting for user approval |
| `layoutLoaded` | Startup / import / external sync |
| `existingCats` | Webview restored after reload |

**Webview → Extension:**

| Message | When |
|---------|------|
| `focusCat` | Cat clicked (focuses terminal) |
| `closeCat` | Remove cat |
| `saveLayout` | Editor save |
| `saveCatSeats` | Seat reassignment |

---

### 12. Build Pipeline

```
src/           → esbuild  → dist/extension.js     (extension host)
webview-ui/    → Vite     → dist/webview/          (browser bundle)
assets/        → copy     → dist/assets/           (sprites)
test/          → Vitest   → coverage/
```

**Dev:** `npm run dev` (watch both) → F5 to launch Extension Development Host.

---

### 13. Performance Targets

| Metric | Target |
|--------|--------|
| Frame rate | 60 FPS with 20 cats |
| Webview memory | < 50 MB heap |
| Sprite atlas | < 2 MB total |
| JSONL → cat reaction | < 500 ms |
| Extension activation | < 200 ms |

---

### 14. Future Ideas

- **Cat personalities** — breed-specific behavior weights (orange cats = more zoomies, void cats = more naps)
- **Seasonal themes** — holiday decor, snow particles on windows
- **Cat journal** — session log ("Mav typed 42 lines, napped 3 times, did zoomies twice")
- **Community sprite packs** — user-contributed breeds and furniture
- **Achievements** — "First Nap Pile", "Keyboard Cat", "Midnight Zoomies"
