// ── Particle system for spawn/despawn effects (Phase 11) ────

interface Particle {
  x: number;      // world position
  y: number;
  vx: number;     // world px/sec
  vy: number;
  life: number;   // remaining seconds
  maxLife: number;
  size: number;   // world px
  color: string;
  char?: string;  // for matrix effect
}

const particles: Particle[] = [];

// ── Emit functions ──────────────────────────────────────────

const SPARKLE_COLORS = ['#ffee88', '#ffffff', '#ffdd44', '#ffcc00'];
const PAW_COLORS = ['#cc8844', '#a06630', '#ddaa66'];
const MATRIX_CHARS = '01{}[]<>|/\\';

export function emitSpawnEffect(x: number, y: number, isSubagent: boolean): void {
  if (isSubagent) {
    emitMatrix(x, y);
  } else {
    emitSparkles(x, y);
  }
}

export function emitDespawnEffect(x: number, y: number, isSubagent: boolean): void {
  if (isSubagent) {
    emitMatrix(x, y);
  } else {
    emitPawPrints(x, y);
  }
}

function emitSparkles(x: number, y: number): void {
  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 30;
    const life = 0.3 + Math.random() * 0.3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 10,
      life, maxLife: life,
      size: 1 + Math.random(),
      color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    });
  }
}

function emitPawPrints(x: number, y: number): void {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 25;
    const life = 0.4 + Math.random() * 0.4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life, maxLife: life,
      size: 1 + Math.random() * 0.5,
      color: PAW_COLORS[Math.floor(Math.random() * PAW_COLORS.length)],
    });
  }
}

function emitMatrix(x: number, y: number): void {
  for (let i = 0; i < 8; i++) {
    const col = (i - 4) * 2;
    const life = 0.4 + Math.random() * 0.3;
    particles.push({
      x: x + col,
      y: y - 12 - Math.random() * 8,
      vx: 0,
      vy: 30 + Math.random() * 20,
      life, maxLife: life,
      size: 3,
      color: '#00ff88',
      char: MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)],
    });
  }
}

// ── Update ──────────────────────────────────────────────────

export function updateParticles(dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// ── Draw ────────────────────────────────────────────────────

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  if (particles.length === 0) return;

  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    const dx = Math.round(offsetX + p.x * zoom);
    const dy = Math.round(offsetY + p.y * zoom);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    if (p.char) {
      ctx.font = `${Math.round(p.size * zoom)}px monospace`;
      ctx.fillText(p.char, dx, dy);
    } else {
      const size = Math.max(1, Math.round(p.size * zoom));
      ctx.fillRect(Math.round(dx - size / 2), Math.round(dy - size / 2), size, size);
    }
  }
  ctx.globalAlpha = 1;
}
