import { AGENT_IDLE_COOLDOWN_SEC, DEFAULT_GRID_COLS, DEFAULT_GRID_ROWS, TILE_SIZE, WALK_SPEED } from './constants.ts';
import { addCat, cats, getCat, makeCat, removeCat } from './engine/catStore.ts';
import type { CatBreed } from './types.ts';

/**
 * Handle incoming messages from the extension and update catStore accordingly.
 * Pure side-effect function — reads/writes the catStore singleton.
 */
export function dispatchMessage(msg: { type: string } & Record<string, unknown>): void {
  switch (msg.type) {
    case 'catSpawned': {
      const agentId = msg.agentId as string;
      const seatCol = msg.seatCol as number;
      const seatRow = msg.seatRow as number;
      const breed = msg.breed as CatBreed;

      const cat = makeCat(`agent-${agentId}`, seatCol, seatRow, breed);
      cat.agentId = agentId;
      cat.hueShift = msg.hueShift as number;
      cat.seatCol = seatCol;
      cat.seatRow = seatRow;
      cat.isSubagent = msg.isSubagent as boolean;
      cat.parentAgentId = msg.parentAgentId as string | null;

      // Spawn at a random position — cat will walk to seat when agent becomes active
      const spawnCol = Math.floor(Math.random() * DEFAULT_GRID_COLS);
      const spawnRow = Math.floor(Math.random() * DEFAULT_GRID_ROWS);
      cat.tileCol = spawnCol;
      cat.tileRow = spawnRow;
      cat.x = spawnCol * TILE_SIZE + TILE_SIZE / 2;
      cat.y = spawnRow * TILE_SIZE + TILE_SIZE / 2;

      addCat(cat);
      break;
    }

    case 'catDespawned': {
      removeCat(`agent-${msg.agentId as string}`);
      break;
    }

    case 'agentActive': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat) break;

      const catState = msg.catState as 'type' | 'read' | 'wait';
      cat.activeTool = msg.tool as string;
      cat.targetWorkState = catState;

      // If already at seat, enter work state immediately
      if (cat.tileCol === cat.seatCol && cat.tileRow === cat.seatRow) {
        cat.state = catState;
        cat.stateTimer = 0;
        cat.frame = 0;
        cat.frameTimer = 0;
      } else {
        // Interrupt current behavior and walk to seat
        cat.state = 'walk';
        cat.path = [{ col: cat.seatCol, row: cat.seatRow }];
        cat.moveProgress = 0;
        cat.speed = WALK_SPEED;
        cat.stateTimer = 0;
        // On arrival, stateMachine.onArrival checks targetWorkState + seat position
      }
      break;
    }

    case 'agentIdle': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat) break;

      cat.activeTool = null;
      cat.targetWorkState = null;
      cat.state = 'idle';
      cat.stateTimer = 0;
      cat.stateDuration = AGENT_IDLE_COOLDOWN_SEC; // 2s cooldown before first idle behavior
      cat.path = [];
      cat.moveProgress = 0;
      break;
    }

    case 'agentPermission': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat) break;

      cat.bubbleType = 'permission';
      cat.bubbleTimer = 0;

      // Switch to wait state if currently working
      if (cat.state === 'type' || cat.state === 'read') {
        cat.state = 'wait';
        cat.stateTimer = 0;
      }
      break;
    }

    case 'existingCats': {
      // Remove any existing agent cats (preserve test cats if any)
      for (const [id] of cats) {
        if (id.startsWith('agent-')) removeCat(id);
      }

      const agentList = msg.cats as Array<{
        agentId: string;
        breed: CatBreed;
        hueShift: number;
        seatCol: number;
        seatRow: number;
        isSubagent: boolean;
        parentAgentId: string | null;
        status: string;
        activeTool: string | null;
      }>;

      for (const data of agentList) {
        const cat = makeCat(
          `agent-${data.agentId}`,
          data.seatCol,
          data.seatRow,
          data.breed,
        );
        cat.agentId = data.agentId;
        cat.hueShift = data.hueShift;
        cat.seatCol = data.seatCol;
        cat.seatRow = data.seatRow;
        cat.isSubagent = data.isSubagent;
        cat.parentAgentId = data.parentAgentId;

        // Place restored cats at their seat (no spawn animation)
        cat.tileCol = data.seatCol;
        cat.tileRow = data.seatRow;
        cat.x = data.seatCol * TILE_SIZE + TILE_SIZE / 2;
        cat.y = data.seatRow * TILE_SIZE + TILE_SIZE / 2;

        // Restore current state
        if (data.status === 'active' && data.activeTool) {
          cat.activeTool = data.activeTool;
          cat.targetWorkState = mapToolToCatState(data.activeTool);
          cat.state = cat.targetWorkState;
        } else if (data.status === 'waiting') {
          cat.state = 'wait';
          cat.bubbleType = 'permission';
        }
        // 'idle' → stays in default idle state from makeCat

        addCat(cat);
      }
      break;
    }

    // settingsLoaded, etc. handled elsewhere
    default:
      break;
  }
}

// ── Local tool→cat state mapping (mirrors extension-side toolToCatState) ──

const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']);
const WAITING_TOOLS = new Set(['AskUserQuestion']);

function mapToolToCatState(toolName: string): 'type' | 'read' | 'wait' {
  if (READING_TOOLS.has(toolName)) return 'read';
  if (WAITING_TOOLS.has(toolName)) return 'wait';
  return 'type';
}
