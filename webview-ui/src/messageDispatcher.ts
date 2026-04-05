import { AGENT_IDLE_COOLDOWN_SEC, WALK_SPEED } from './constants.ts';
import { deserializeLayout } from './editor/layoutSerializer.ts';
import { playMew, playPurr, playChime } from './engine/audio/audioEngine.ts';
import { addCat, cats, getCat, makeCat, removeCat } from './engine/catStore.ts';
import { applySettingsLoaded } from './settingsStore.ts';
import { tileCenter } from './engine/movement.ts';
import { findPath } from './engine/pathfinding.ts';
import { emitDespawnEffect, emitSpawnEffect } from './engine/renderer/effectRenderer.ts';
import { getBlockedTiles, setDeskActiveBySeat } from './environment/furnitureStore.ts';
import { isWalkable, randomWalkableTile, tileMap } from './environment/tileMap.ts';
import type { CatBreed } from './types.ts';
import { toggleStressTest, isStressTestActive } from './engine/renderer/debugOverlay.ts';

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

      // Spawn at a random walkable tile — cat will walk to seat when agent becomes active
      const spawn = randomWalkableTile(tileMap, getBlockedTiles()) ?? { col: seatCol, row: seatRow };
      cat.tileCol = spawn.col;
      cat.tileRow = spawn.row;
      cat.x = tileCenter(spawn.col);
      cat.y = tileCenter(spawn.row);

      // Spawn effect: fade in + particles (restored agents skip — spawnEffect stays false)
      cat.spawnEffect = true;
      cat.effectTimer = 0;

      addCat(cat);
      emitSpawnEffect(cat.x, cat.y, cat.isSubagent);
      playMew();
      break;
    }

    case 'catDespawned': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat) break;

      // Toggle desk monitor off
      setDeskActiveBySeat(cat.seatCol, cat.seatRow, false);

      // Start despawn effect — cat fades out over DESPAWN_DURATION then gets removed
      cat.despawnEffect = true;
      cat.effectTimer = 0;
      cat.state = 'stretch';  // yawn pose → transitions to curled at midpoint
      cat.frame = 0;
      cat.frameTimer = 0;
      cat.direction = 'down';
      cat.path = [];
      cat.targetWorkState = null;
      emitDespawnEffect(cat.x, cat.y, cat.isSubagent);
      break;
    }

    case 'agentActive': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat || cat.despawnEffect) break;

      const catState = msg.catState as 'type' | 'read' | 'wait';
      cat.activeTool = msg.tool as string;
      cat.targetWorkState = catState;

      // Show waiting bubble for wait state (AskUserQuestion), clear for others
      if (catState === 'wait') {
        cat.bubbleType = 'waiting';
        cat.bubbleTimer = 0;
      } else {
        cat.bubbleType = null;
        cat.bubbleTimer = 0;
      }

      // Toggle desk monitor on
      setDeskActiveBySeat(cat.seatCol, cat.seatRow, true);

      // BFS-walk to seat; if already there (or unreachable), enter work state directly
      const blocked = getBlockedTiles();
      const path = findPath(cat.tileCol, cat.tileRow, cat.seatCol, cat.seatRow, tileMap, blocked);
      if (path.length > 0) {
        cat.state = 'walk';
        cat.path = path;
        cat.moveProgress = 0;
        cat.speed = WALK_SPEED;
        cat.stateTimer = 0;
        // On arrival, stateMachine.onArrival checks targetWorkState + seat position
      } else {
        cat.state = catState;
        cat.stateTimer = 0;
        cat.frame = 0;
        cat.frameTimer = 0;
      }
      break;
    }

    case 'agentIdle': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat || cat.despawnEffect) break;

      // Toggle desk monitor off
      setDeskActiveBySeat(cat.seatCol, cat.seatRow, false);

      cat.activeTool = null;
      cat.targetWorkState = null;
      cat.state = 'idle';
      cat.stateTimer = 0;
      cat.stateDuration = AGENT_IDLE_COOLDOWN_SEC; // 2s cooldown before first idle behavior
      cat.path = [];
      cat.moveProgress = 0;

      // Clear any active bubble
      cat.bubbleType = null;
      cat.bubbleTimer = 0;
      playChime();
      break;
    }

    case 'agentPermission': {
      const cat = getCat(`agent-${msg.agentId as string}`);
      if (!cat || cat.despawnEffect) break;

      cat.bubbleType = 'permission';
      cat.bubbleTimer = 0;

      // Switch to wait state if currently working
      if (cat.state === 'type' || cat.state === 'read') {
        cat.state = 'wait';
        cat.stateTimer = 0;
      }
      playPurr();
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
        cat.x = tileCenter(data.seatCol);
        cat.y = tileCenter(data.seatRow);

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

    case 'layoutLoaded': {
      if (deserializeLayout(msg.json as string)) {
        // Re-validate cat positions — move cats on non-walkable tiles
        const blocked = getBlockedTiles();
        for (const cat of cats.values()) {
          if (!isWalkable(tileMap, cat.tileCol, cat.tileRow, blocked)) {
            const spot = randomWalkableTile(tileMap, blocked);
            if (spot) {
              cat.tileCol = spot.col;
              cat.tileRow = spot.row;
              cat.x = tileCenter(spot.col);
              cat.y = tileCenter(spot.row);
              cat.path = [];
              cat.moveProgress = 0;
            }
          }
        }
      }
      break;
    }

    case 'settingsLoaded':
      applySettingsLoaded(msg);
      break;

    case 'debugStressTest': {
      toggleStressTest();
      const active = isStressTestActive();
      if (active) {
        const breeds: CatBreed[] = ['tabby', 'tuxedo', 'calico', 'siamese', 'void', 'orange'];
        const blocked = getBlockedTiles();
        for (let i = 0; i < 20; i++) {
          const breed = breeds[i % breeds.length];
          const spawn = randomWalkableTile(tileMap, blocked) ?? { col: 0, row: 0 };
          const cat = makeCat(`test-${i}`, spawn.col, spawn.row, breed);
          cat.x = tileCenter(spawn.col);
          cat.y = tileCenter(spawn.row);
          addCat(cat);
          emitSpawnEffect(cat.x, cat.y, false);
        }
      } else {
        // Remove all test cats
        for (const [id] of cats) {
          if (id.startsWith('test-')) removeCat(id);
        }
      }
      break;
    }

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
