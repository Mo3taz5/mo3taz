/**
 * ============================================================
 * use-focusable.ts — DOM-to-Matrix bridge with FrameBatcher
 * ============================================================
 *
 * Registers DOM elements into the FocusMatrix on mount,
 * syncs refs on updates (throttled to 16ms), and unregisters
 * on unmount. Zero memory leaks.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { getFocusMatrix, Direction } from "@shared";

export interface UseFocusableOptions {
  /** Unique identifier for this focusable element */
  id: string;
  /** Logical group name (e.g. "navBar", "grid") */
  group: string;
  /** Linear index within the group (0-based) */
  index: number;
  /** Called when this element receives a "select" action (Enter/A) */
  onSelect?: () => void;
}

export interface UseFocusableReturn<T extends HTMLElement = HTMLDivElement> {
  /** Attach this ref to the root DOM element */
  ref: React.RefObject<T | null>;
  /** Whether this element currently has focus */
  isFocused: boolean;
}

/** Throttle interval for DOM ref sync — 1 frame at 60fps */
const SYNC_THROTTLE_MS = 16;

export function useFocusable<T extends HTMLElement = HTMLDivElement>({
  id,
  group,
  index,
  onSelect,
}: UseFocusableOptions): UseFocusableReturn<T> {
  const domRef = useRef<T | null>(null) as React.RefObject<T | null>;
  const matrix = useMemo(() => getFocusMatrix(), []);
  const lastSyncTime = useRef(0);

  // --- Step 1: Register / unregister cell in the matrix ---
  useEffect(() => {
    matrix.register(id, group, index);
    return () => {
      matrix.unregister(id);
    };
  }, [id, group, index, matrix]);

  // --- Step 2: Sync DOM reference — throttled to 1 frame (16ms) ---
  // Prevents layout thrashing by skipping sync if called within the same frame
  useEffect(() => {
    const now = performance.now();
    if (now - lastSyncTime.current < SYNC_THROTTLE_MS) return;
    lastSyncTime.current = now;

    matrix.setDomRef(id, domRef.current);

    return () => {
      matrix.setDomRef(id, null);
    };
  }, [id, matrix, domRef.current]);

  // --- Step 3: Bind click/select handler with cleanup ---
  const handleClick = useCallback(() => {
    if (onSelect) onSelect();
  }, [onSelect]);

  useEffect(() => {
    const el = domRef.current;
    if (!el || !handleClick) return;
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [handleClick]);

  return {
    ref: domRef,
    isFocused: matrix.getActiveId() === id,
  };
}

/**
 * Hook that exposes navigation methods for controller/keyboard input.
 */
export function useFocusNavigation() {
  const matrix = useMemo(() => getFocusMatrix(), []);

  const navigate = useCallback(
    (direction: Direction) => {
      const currentId = matrix.getActiveId();
      if (!currentId) return null;
      return matrix.navigate(currentId, direction);
    },
    [matrix]
  );

  const setActive = useCallback(
    (id: string | null) => {
      matrix.setActiveId(id);
    },
    [matrix]
  );

  const getActiveId = useCallback(() => matrix.getActiveId(), [matrix]);

  return { navigate, setActive, getActiveId };
}
