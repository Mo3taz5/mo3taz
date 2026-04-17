/**
 * ============================================================
 * FocusRing.tsx — Ref-based animated focus highlight
 * ============================================================
 *
 * ZERO React re-renders. Uses direct DOM manipulation via useRef
 * and requestAnimationFrame for 60fps animation.
 * 
 * Architecture:
 *   - Static div with willChange: transform
 *   - rAF loop polls FocusMatrix for active element bounds
 *   - Direct style property writes bypass React reconciliation
 *   - Skip optimization: skips style write if same element is focused
 */

import { useEffect, useRef, useMemo } from "react";
import { getFocusMatrix } from "@shared";

const FOCUS_RING_PADDING = 6;

/**
 * FocusRing — Ref-based animated border around the focused element.
 * 
 * Performance characteristics:
 *   - 0 React re-renders per frame
 *   - Direct CSSOM writes via element.style
 *   - willChange: transform promotes to GPU compositor layer
 *   - CSS transition handles interpolation between positions
 */
export function FocusRing() {
  const ringRef = useRef<HTMLDivElement>(null);
  const matrix = useMemo(() => getFocusMatrix(), []);

  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;

    // Initial hidden state
    el.style.opacity = "0";

    let rafId: number;
    let lastActiveId: string | null = null;

    const tick = () => {
      const activeId = matrix.getActiveId();

      // No active focus target — hide ring
      if (!activeId) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        rafId = requestAnimationFrame(tick);
        return;
      }

      // Skip if same element — avoid redundant style writes
      if (activeId === lastActiveId) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      lastActiveId = activeId;

      const cell = matrix.getCell(activeId);
      const target = cell?.domRef;

      // Target element not in DOM yet — hide ring
      if (!target) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        rafId = requestAnimationFrame(tick);
        return;
      }

      const rect = target.getBoundingClientRect();
      const x = rect.left - FOCUS_RING_PADDING;
      const y = rect.top - FOCUS_RING_PADDING;
      const w = rect.width + FOCUS_RING_PADDING * 2;
      const h = rect.height + FOCUS_RING_PADDING * 2;

      // Direct style mutations — ZERO React re-renders
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.opacity = "1";

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [matrix]);

  // Static element — never changes, never re-renders
  return (
    <div
      ref={ringRef}
      className="big-screen__focus-ring"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: "none",
        borderRadius: "16px",
        border: "2px solid #ffffff",
        boxShadow:
          "0 0 20px rgba(255, 255, 255, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        backdropFilter: "brightness(1.1)",
        WebkitBackdropFilter: "brightness(1.1)",
        zIndex: 2000,
        willChange: "transform, width, height",
        transition: "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  );
}
