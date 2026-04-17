/**
 * ============================================================
 * FocusMatrix v2 — Vector-based spatial focus engine
 * ============================================================
 * 
 * ZERO React/DOM dependencies. Pure TypeScript.
 * Uses directional vector dot products for natural navigation.
 * Frame-batched state updates prevent layout thrashing.
 */

// ---- Strict Type Definitions ----

export interface MatrixCell {
  id: string;
  row: number;
  col: number;
  group: string;
  groupIndex: number;
  domRef: HTMLElement | null;
}

export interface GroupConfig {
  startRow: number;
  columnsPerRow: number;
  wraps: boolean;
}

export type Direction = "up" | "down" | "left" | "right";

export interface IBatcher {
  schedule(fn: () => void): void;
  dispose(): void;
}

export interface IFocusMatrix {
  register(id: string, group: string, groupIndex: number): void;
  unregister(id: string): void;
  setDomRef(id: string, ref: HTMLElement | null): void;
  navigate(currentId: string, direction: Direction): string | null;
  getCell(id: string): MatrixCell | null;
  getAllCells(): ReadonlyMap<string, MatrixCell>;
  setGroups(groups: Record<string, GroupConfig>): void;
  reset(): void;
  getActiveId(): string | null;
  setActiveId(id: string | null): void;
}

// ---- Directional Vector Constants ----

/**
 * DIRECTION_VECTORS:
 * [x, y] where x = horizontal, y = vertical
 * up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
 */
const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Angular penalty multiplier — how strongly we penalize off-axis targets */
const ANGULAR_PENALTY_MULTIPLIER = 2;

// ---- FrameBatcher Middleware ----

/**
 * FrameBatcher — Coalesces multiple state updates into a single 
 * requestAnimationFrame tick (~16ms). Prevents layout thrashing by 
 * ensuring all DOM reads happen before writes, and only one batch
 * fires per frame.
 */
export class FrameBatcher implements IBatcher {
  private pending = new Set<() => void>();
  private rafId: number | null = null;

  schedule(fn: () => void): void {
    this.pending.add(fn);
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  private flush(): void {
    const batch = [...this.pending];
    this.pending.clear();
    this.rafId = null;
    for (const fn of batch) fn();
  }

  dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.pending.clear();
    this.rafId = null;
  }
}

// ---- Factory Implementation ----

export function createFocusMatrix(
  initialGroups: Record<string, GroupConfig> = {},
  batcher: IBatcher = new FrameBatcher()
): IFocusMatrix {
  const cells = new Map<string, MatrixCell>();
  const groups: Record<string, GroupConfig> = { ...initialGroups };
  let activeId: string | null = null;

  function computeCoordinates(
    group: string,
    groupIndex: number
  ): { row: number; col: number } {
    const cfg = groups[group];
    if (!cfg) return { row: 0, col: groupIndex };
    return {
      row: cfg.startRow + Math.floor(groupIndex / cfg.columnsPerRow),
      col: groupIndex % cfg.columnsPerRow,
    };
  }

  return {
    register(id: string, group: string, groupIndex: number): void {
      const existing = cells.get(id);
      if (existing) {
        const { row, col } = computeCoordinates(group, groupIndex);
        existing.row = row;
        existing.col = col;
        existing.group = group;
        existing.groupIndex = groupIndex;
        return;
      }
      const { row, col } = computeCoordinates(group, groupIndex);
      cells.set(id, { id, row, col, group, groupIndex, domRef: null });
    },

    unregister(id: string): void {
      cells.delete(id);
      if (activeId === id) {
        batcher.schedule(() => { activeId = null; });
      }
    },

    setDomRef(id: string, ref: HTMLElement | null): void {
      batcher.schedule(() => {
        const cell = cells.get(id);
        if (cell) cell.domRef = ref;
      });
    },

    /**
     * DIRECTIONAL VECTOR SCORING:
     * 
     * For each candidate cell in the requested direction:
     *   1. Compute vector from current to candidate: (dx, dy)
     *   2. Compute dot product with direction vector
     *   3. Skip if dot product <= 0 (behind or perpendicular)
     *   4. Calculate angular penalty: 1 - (dot / distance)
     *   5. Final score: distance * (1 + anglePenalty * 2)
     * 
     * This ensures cells directly in the pressed direction score lowest,
     * while diagonally-offset cells are penalized proportionally.
     */
    navigate(currentId: string, direction: Direction): string | null {
      const current = cells.get(currentId);
      if (!current) return null;

      const [dirX, dirY] = DIRECTION_VECTORS[direction];
      let bestId: string | null = null;
      let bestScore = Infinity;

      for (const [candidateId, candidate] of cells) {
        if (candidateId === currentId) continue;

        // Vector from current cell to candidate
        const dx = candidate.col - current.col;
        const dy = candidate.row - current.row;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist === 0) continue;

        // Dot product: how aligned is the candidate with the input direction?
        // Positive = in direction, Negative = opposite, Zero = perpendicular
        const alignment = dx * dirX + dy * dirY;

        // Skip candidates behind or perpendicular to input
        if (alignment <= 0) continue;

        // Angular penalty: 0 = perfectly aligned, approaches 1 at 90°
        const anglePenalty = 1 - (alignment / dist);

        // Combined score: distance weighted by angular alignment
        const score = dist * (1 + anglePenalty * ANGULAR_PENALTY_MULTIPLIER);

        if (score < bestScore) {
          bestScore = score;
          bestId = candidateId;
        }
      }

      if (bestId) {
        batcher.schedule(() => { activeId = bestId; });
      }

      return bestId;
    },

    getCell(id: string): MatrixCell | null {
      return cells.get(id) ?? null;
    },

    getAllCells(): ReadonlyMap<string, MatrixCell> {
      return cells;
    },

    setGroups(newGroups: Record<string, GroupConfig>): void {
      Object.assign(groups, newGroups);
      for (const cell of cells.values()) {
        const { row, col } = computeCoordinates(cell.group, cell.groupIndex);
        cell.row = row;
        cell.col = col;
      }
    },

    reset(): void {
      cells.clear();
      activeId = null;
    },

    getActiveId(): string | null {
      return activeId;
    },

    setActiveId(id: string | null): void {
      activeId = id;
    },
  };
}

// ---- Global Singleton ----

let _instance: IFocusMatrix | null = null;
const _batcher = new FrameBatcher();

export function getFocusMatrix(): IFocusMatrix {
  if (!_instance) _instance = createFocusMatrix({}, _batcher);
  return _instance;
}
