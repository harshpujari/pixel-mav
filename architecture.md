# Pixel Mav - Architecture

> A VS Code extension that brings Claude Code agents to life as animated pixel art cats in a cozy virtual space.

Each Claude Code terminal spawns a unique cat character that reacts in real-time — typing when the agent writes code, reading when it searches, napping when idle, and occasionally doing zoomies.

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
│  ┌──────┴─────┴──┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Webview        │  │ Layout       │  │ Asset            │  │
│  │ Provider       │──│ Persistence  │  │ Loader           │  │
│  │ (IPC bridge)   │  │ (versioned)  │  │ (sprites/atlas)  │  │
│  └──────┬─────────┘  └──────────────┘  └──────────────────┘  │
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
│  │  │ Game Loop   │  │ ECS World  │  │ Renderer       │  │   │
│  │  │ (RAF + dt)  │──│ (entities, │──│ (Canvas 2D,    │  │   │
│  │  │             │  │ components,│  │ dirty regions) │  │   │
│  │  │             │  │ systems)   │  │                │  │   │
│  │  └─────────────┘  └─────┬──────┘  └────────────────┘  │   │
│  │                         │                              │   │
│  │  ┌────────────┐  ┌──────┴──────┐  ┌────────────────┐  │   │
│  │  │ Behavior   │  │ Pathfinding │  │ Sprite Atlas   │  │   │
│  │  │ Trees      │  │ (A*)        │  │ & Cache        │  │   │
│  │  └────────────┘  └─────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ UI Layer   │  │ Editor       │  │ Zustand Store        │ │
│  │ (React)    │  │ (layout)     │  │ (single truth)       │ │
│  └────────────┘  └──────────────┘  └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The extension lives in two processes connected via `postMessage`:

- **Extension Host** — Node.js. Manages terminals, watches Claude Code's JSONL transcript files, detects agent state transitions, loads assets, persists layouts.
- **Webview** — Browser sandbox. Runs the game engine (Canvas 2D), renders cats and the environment, handles user interaction.

---

## Project Structure

```
pixel-mav/
├── src/                              # Extension backend (TypeScript)
│   ├── extension.ts                  # Entry: activate(), deactivate()
│   ├── webviewProvider.ts            # WebviewViewProvider, IPC bridge
│   ├── agentManager.ts              # Terminal lifecycle, agent spawn/despawn
│   ├── transcriptWatcher.ts         # JSONL file watching (fs.watch + polling)
│   ├── transcriptParser.ts          # JSONL → typed agent events
│   ├── stateReconciler.ts           # Debounced events → clean state transitions
│   ├── assetLoader.ts               # PNG → sprite data, atlas generation
│   ├── layoutStore.ts               # Versioned layout persistence
│   ├── constants.ts                 # Extension-side constants
│   └── types.ts                     # Shared interfaces
│
├── webview-ui/                       # React + TypeScript + Vite
│   └── src/
│       ├── main.tsx                  # Vite entry
│       ├── App.tsx                   # Root component
│       ├── store.ts                  # Zustand store (UI + game bridge)
│       ├── constants.ts             # Game/rendering constants
│       ├── vscodeApi.ts             # postMessage bridge
│       │
│       ├── engine/                   # Pure game engine (no React deps)
│       │   ├── gameLoop.ts          # RAF loop, fixed timestep, delta cap
│       │   ├── ecs/
│       │   │   ├── world.ts         # Entity registry, component storage
│       │   │   ├── entity.ts        # Entity ID generation
│       │   │   ├── components.ts    # Component type definitions
│       │   │   └── systems/
│       │   │       ├── movement.ts  # Position updates, interpolation
│       │   │       ├── animation.ts # Frame advancement, state transitions
│       │   │       ├── behavior.ts  # Behavior tree evaluation
│       │   │       ├── pathfinding.ts
│       │   │       └── activity.ts  # Agent tool state → cat behavior
│       │   │
│       │   ├── behaviors/           # Behavior tree nodes
│       │   │   ├── tree.ts          # BT engine (selector, sequence, decorator)
│       │   │   ├── catIdle.ts       # Sleep, groom, stretch
│       │   │   ├── catActive.ts     # Type, read, pounce
│       │   │   ├── catWander.ts     # Prowl, patrol, zoomies
│       │   │   └── catSocial.ts     # Multi-cat interactions
│       │   │
│       │   ├── pathfinding/
│       │   │   ├── astar.ts         # A* with weighted tiles
│       │   │   └── navGrid.ts       # Navigation grid, tile costs
│       │   │
│       │   └── renderer/
│       │       ├── renderer.ts      # Main render orchestrator
│       │       ├── tileRenderer.ts  # Floor + wall rendering
│       │       ├── entityRenderer.ts
│       │       ├── effectRenderer.ts # Spawn/despawn, particles
│       │       ├── uiRenderer.ts    # Speech bubbles, status labels
│       │       └── camera.ts        # Viewport, pan, zoom, follow
│       │
│       ├── sprites/
│       │   ├── atlas.ts             # Sprite atlas packing + lookup
│       │   ├── catSprites.ts        # Cat sprite definitions
│       │   ├── furnitureSprites.ts
│       │   ├── tileSprites.ts
│       │   └── colorize.ts          # HSL colorization for fur patterns
│       │
│       ├── environment/
│       │   ├── types.ts             # Layout, tile, furniture types
│       │   ├── tileMap.ts           # 2D tile grid, walkability
│       │   ├── furnitureCatalog.ts  # Cat furniture catalog
│       │   └── layoutSerializer.ts  # Layout ↔ JSON with migrations
│       │
│       ├── editor/
│       │   ├── editorState.ts       # Tool selection, undo/redo
│       │   ├── editorActions.ts     # Pure layout mutation functions
│       │   └── EditorToolbar.tsx    # Palette, tools, color pickers
│       │
│       ├── components/              # React UI
│       │   ├── GameCanvas.tsx       # Canvas, mouse/keyboard input
│       │   ├── Toolbar.tsx          # Bottom bar: +Cat, Layout, Settings
│       │   ├── ZoomControls.tsx
│       │   ├── SettingsModal.tsx
│       │   ├── CatBadge.tsx         # Activity overlay above cats
│       │   └── DebugOverlay.tsx
│       │
│       └── audio/
│           ├── sounds.ts            # Web Audio: purr, meow, chime
│           └── audioManager.ts
│
├── assets/                           # Source sprites
│   ├── cats/                        # Breed sprite sheets
│   ├── furniture/                   # Cat-themed furniture
│   ├── tiles/                       # Floor + wall patterns
│   └── effects/                     # Particles (yarn, paw prints)
│
├── scripts/                          # Build utilities
│   ├── build.ts                     # esbuild (extension)
│   ├── import-tileset.ts            # Asset import pipeline
│   └── generate-atlas.ts           # Sprite atlas packer
│
├── test/
│   ├── engine/                      # Vitest unit tests
│   └── integration/                 # Playwright tests
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── architecture.md
```

---

## Core Systems

### 1. Entity-Component-System (ECS)

All game objects (cats, furniture, effects) are entities — just numeric IDs with attached component data. Systems operate on component groups each frame.

**Components** (pure data):

```typescript
interface PositionComponent {
  col: number;  row: number
  pixelX: number;  pixelY: number   // interpolated render position
}

interface SpriteComponent {
  atlasKey: string
  frameIndex: number
  direction: Direction
  flipX: boolean
  tint?: HSLShift
}

interface MovementComponent {
  path: Vec2[]          // A* waypoints
  pathIndex: number
  speed: number         // px/sec
  progress: number      // 0–1 between waypoints
}

interface AnimationComponent {
  state: CatAnimState   // IDLE | WALK | TYPE | READ | SLEEP | GROOM | STRETCH | ZOOMIES
  frameTimer: number
  frameDuration: number
  loop: boolean
}

interface AgentComponent {
  agentId: string
  terminalId: number
  seatId: string
  activeTool: string | null
  isWaiting: boolean
  parentAgentId?: string   // sub-agents
}

interface BehaviorComponent {
  tree: BehaviorNode
  blackboard: Map<string, unknown>
}
```

**Systems** (run each frame in order):

```
ActivitySystem    → maps agent tool events to behavior signals
BehaviorSystem    → evaluates behavior trees, picks actions
PathfindingSystem → runs A* when behavior requests a destination
MovementSystem    → advances position along path
AnimationSystem   → ticks frame timers, advances sprites
RenderSystem      → draws entities Z-sorted by Y
```

This separation means new behaviors are just new components + systems — no existing code touched.

---

### 2. Cat Behavior Trees

Cats use behavior trees for natural-looking actions instead of a basic state machine.

```
Root (Selector)
├── AgentActive (Sequence)                    # Claude is using a tool
│   ├── WalkToSeat (if not already there)
│   ├── SitDown
│   └── Selector
│       ├── TypeAnimation (Write/Edit/Bash)   # paws on keyboard
│       ├── ReadAnimation (Read/Grep/Glob)    # eyes scanning
│       └── WaitAnimation (permission)        # look around impatiently
│
├── AgentIdle (Sequence)                      # Claude waiting for input
│   ├── IdleBehavior (WeightedRandom)
│   │   ├── Sleep       (40%)   # curl up, Z bubbles, min 8s
│   │   ├── Groom       (20%)   # lick paw, min 3s
│   │   ├── Stretch     (10%)   # big stretch + yawn
│   │   ├── Wander      (20%)   # explore (prefer sunny spots)
│   │   └── Zoomies     (10%)   # sudden burst of speed!
│   │
│   └── SocialBehavior (if nearby cats)
│       ├── NapPile     # sleep near another sleeping cat
│       ├── Play        # chase another cat
│       └── Headbonk    # walk over, bump animation
│
└── Fallback → sit at seat, idle blink
```

**Node types:**
- **Selector** — try children in order, succeed on first success
- **Sequence** — run children in order, fail on first failure
- **WeightedRandom** — pick one child by weight
- **Decorator** — modify child (MinDuration, Cooldown, Inverter)
- **Leaf** — concrete action (WalkTo, PlayAnimation, Wait)

---

### 3. A\* Pathfinding with Weighted Tiles

```typescript
interface NavGrid {
  width: number
  height: number
  costs: Float32Array   // per-tile cost. 1.0 = normal, Infinity = blocked
}

// Example tile costs:
// Floor:       1.0
// Sunny spot:  0.5   (cats gravitate toward warmth)
// Near window: 0.7
// Water bowl:  2.0   (cats avoid water)
// Blocked:     Infinity
```

- 8-connected movement (diagonal allowed, √2 cost)
- Path smoothing removes unnecessary waypoints on straight lines
- Cached paths invalidated only on layout changes

---

### 4. Agent State Detection

The extension watches Claude Code's JSONL transcript files to detect what each agent is doing.

```
JSONL record
    │
    ▼
TranscriptParser        # Parse raw JSONL → typed events
    │
    ▼
EventBuffer             # Collect events within 200ms window
    │
    ▼
StateReconciler         # Compute clean state transitions
    │                     - Coalesce rapid tool start/stop
    │                     - Track nested sub-agents
    │                     - Use turn_duration as authoritative end signal
    │
    ▼
AgentState              # ACTIVE(tool) | WAITING | IDLE
    │
    ▼
postMessage → Webview   # Single clean update per reconciliation cycle
```

**File watching strategy:** `fs.watch` (primary, event-driven) + `fs.watchFile` (fallback, stat-based polling) for cross-platform reliability. Partial-line buffering handles records split across reads.

**Tool → animation mapping:**
- Read, Grep, Glob, WebFetch, WebSearch → reading animation (eyes scanning, ear twitch)
- Write, Edit, Bash, Task → typing animation (paws on keyboard)
- AskUserQuestion / permission wait → impatient look-around

---

### 5. Rendering

Canvas 2D with dirty-region tracking:

```
1. Camera update (pan / zoom / follow lerp)
2. Compute visible tile range from viewport
3. Render floor tiles (dirty chunks only)
4. Render wall tiles (dirty chunks only)
5. Collect visible entities
6. Z-sort by (row × TILE_SIZE + offsetY)
7. Draw entities from sprite atlas
8. Draw effects (particles, spawn/despawn)
9. Draw UI overlay (bubbles, labels)
```

- Tile grid divided into 8×8 chunks; only re-render chunks that changed
- All sprites packed into a single atlas at build time → one `drawImage` per sprite
- Pre-scaled atlas cached per integer zoom level (1x–10x)
- `imageSmoothingEnabled = false` for crisp pixels
- Game loop pauses when the webview tab is not visible

---

### 6. Cat Sprites

**Sprite sheet layout** (per breed, 128×128, 16×16 frames):

```
Row 0 (Down):    idle | walk1 | walk2 | walk3 | sit | type1 | type2 | read
Row 1 (Up):      idle | walk1 | walk2 | walk3 | sit | type1 | type2 | read
Row 2 (Right):   idle | walk1 | walk2 | walk3 | sit | type1 | type2 | read
Row 3 (Special): sleep1 | sleep2 | groom1 | groom2 | stretch1 | stretch2 | zoomies | pounce
```

Left-facing = horizontally flipped right row at runtime.

**6 breeds:** Tabby, Tuxedo, Calico, Siamese, Void (all-black), Orange. Beyond 6 agents, breed repeats with a random hue shift for uniqueness.

| State | Frames | Speed | Notes |
|---|---|---|---|
| Idle | [0] | — | Occasional blink (random interval) |
| Walk | [1,2,3,2] | 0.15s/frame | Trotting cycle |
| Type | [5,6] | 0.25s/frame | Paws batting keyboard |
| Read | [7] + blink | 0.4s/frame | Eyes scanning, tail flick |
| Sleep | [S0,S1] | 0.8s/frame | Curled up, breathing |
| Groom | [G0,G1] | 0.5s/frame | Lick paw |
| Stretch | [St0,St1] | 0.6s/frame | Stretch + yawn |
| Zoomies | [1,2,3,2] | 0.08s/frame | Walk cycle at 2x speed |

---

### 7. Environment & Furniture

**Tile types:**
- `VOID` — empty, non-walkable, transparent
- `FLOOR` — walkable, colorizable (wood, carpet, tile patterns)
- `WALL` — non-walkable, auto-tiled (4-bit bitmask → 16 variants)
- `SUNNY` — walkable, reduced pathfinding cost (cats gravitate here)

**Cat-themed furniture:**

| Category | Items |
|---|---|
| Work | Tiny laptop, monitor, desk, keyboard |
| Comfort | Cat bed, cat tree, scratching post, window perch, heated pad |
| Food | Food bowl, water fountain, treat dispenser |
| Toys | Yarn ball, feather wand, laser dot (particle effect), cardboard box |
| Decor | Plant, bookshelf, rug, window |

Default grid: 20×11 tiles (expandable to 64×64 in editor). Furniture supports rotation (front/back/left/right variants) and toggle states (electronics on/off).

---

### 8. Layout Editor

Built into the webview, toggled via toolbar:

**Tools:** Select, Floor Paint, Wall Paint, Erase, Place Furniture, Eyedropper

**Features:**
- 50-level undo/redo (layout snapshots)
- Ghost border outside grid — click to expand
- Furniture placement preview with valid (green) / invalid (red) tinting
- Color picker for floor/wall tints (HSL adjustment)
- Right-click to erase
- Keyboard: Ctrl+Z/Y (undo/redo), R (rotate), T (toggle state), Esc (deselect/exit)

**Persistence:** Layouts saved as versioned JSON at `~/.pixel-mav/layout.json`, shared across VS Code windows. File watcher syncs changes between windows.

---

### 9. State Management

**Zustand store** — UI state that React subscribes to:
```typescript
interface PixelMavStore {
  agents: Map<string, AgentInfo>
  selectedCatId: string | null
  isEditorOpen: boolean
  zoom: number
  soundEnabled: boolean
  // actions...
}
```

**Game state object** — engine-internal, never triggers React re-renders:
- Entity positions, paths, animation timers, behavior blackboards
- Updated by systems each frame

**Bridge:** Zustand actions dispatch events into the engine. The engine reads the store for agent data. Clean separation prevents React re-renders from blocking the game loop.

---

### 10. Message Protocol

**Extension → Webview:**

| Message | When |
|---|---|
| `catSpawned` | Terminal created |
| `catDespawned` | Terminal closed |
| `agentActive` | Tool started (after reconciliation) |
| `agentIdle` | Turn ended / waiting for input |
| `agentPermission` | Waiting for user approval |
| `layoutLoaded` | Startup / import / external sync |
| `assetsLoaded` | After asset loading |
| `existingCats` | Webview restored |

**Webview → Extension:**

| Message | When |
|---|---|
| `spawnClaude` | "+ Cat" button |
| `focusCat` | Cat clicked |
| `closeCat` | Remove cat |
| `saveLayout` | Editor save |
| `saveCatSeats` | Seat reassignment |

---

### 11. Spawn & Despawn Effects

**Spawn:** 0.4s particle poof + cat fades in. Optional "mew" sound via Web Audio API.

**Despawn:** Cat yawns, curls up, fades out over 0.5s. Paw-print particles scatter outward.

---

### 12. Build Pipeline

```
src/           → esbuild  → dist/extension.js     (extension host)
webview-ui/    → Vite     → dist/webview/          (browser bundle)
assets/        → copy     → dist/assets/           (sprites, atlas)
test/          → Vitest   → coverage/
```

**Dev:** `npm run dev` (watch both) → F5 to launch Extension Development Host.

---

### 13. Performance Targets

| Metric | Target |
|---|---|
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
