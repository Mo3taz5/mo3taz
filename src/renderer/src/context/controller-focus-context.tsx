import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAppDispatch, useAppSelector } from "@renderer/hooks";
import { toggleControllerMode } from "@renderer/features";

interface FocusableElement {
  id: string;
  element: HTMLElement;
  rect: DOMRect | null;
}

interface ControllerFocusContextValue {
  isControllerMode: boolean;
  focusedElementId: string | null;
  setFocusedElementId: (id: string | null) => void;
  registerElement: (id: string, element: HTMLElement) => void;
  unregisterElement: (id: string) => void;
  navigate: (direction: "up" | "down" | "left" | "right") => void;
  select: () => void;
  goBack: () => void;
  exitControllerMode: () => void;
}

const ControllerFocusContext = createContext<ControllerFocusContextValue>({
  isControllerMode: false,
  focusedElementId: null,
  setFocusedElementId: () => {},
  registerElement: () => {},
  unregisterElement: () => {},
  navigate: () => {},
  select: () => {},
  goBack: () => {},
  exitControllerMode: () => {},
});

export const useControllerFocus = () => useContext(ControllerFocusContext);

export function ControllerFocusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const isControllerMode = useAppSelector(
    (state) => state.controllerMode.isControllerMode
  );

  const [focusedElementId, setFocusedElementId] = useState<string | null>(null);
  const [focusableElements, setFocusableElements] = useState<
    Map<string, FocusableElement>
  >(new Map());

  const lastGamepadState = useRef<{
    buttons: Record<number, boolean>;
  }>({ buttons: {} });

  const lastFocusTime = useRef(0);
  const FOCUS_COOLDOWN = 150; // ms — prevents double-triggering

  const registerElement = useCallback((id: string, element: HTMLElement) => {
    setFocusableElements((prev) => {
      const next = new Map(prev);
      next.set(id, { id, element, rect: null });
      return next;
    });
  }, []);

  const unregisterElement = useCallback((id: string) => {
    setFocusableElements((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Auto-focus first element when entering controller mode
  useEffect(() => {
    if (!isControllerMode) {
      setFocusedElementId(null);
      lastGamepadState.current = { buttons: {} };
      return undefined;
    }

    // Defer to allow DOM to settle
    const timer = setTimeout(() => {
      setFocusableElements((prev) => {
        const firstElement = prev.values().next().value;
        if (firstElement) {
          setFocusedElementId(firstElement.id);
        }
        return prev;
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [isControllerMode]);

  // Memoized spatial navigation calculation
  const findElementInDirection = useCallback(
    (
      direction: "up" | "down" | "left" | "right",
      currentRect: DOMRect,
      elements: Map<string, FocusableElement>
    ): FocusableElement | null => {
      const now = performance.now();
      if (now - lastFocusTime.current < FOCUS_COOLDOWN) return null;

      let bestElement: FocusableElement | null = null;
      let bestScore = Infinity;

      const allElements = Array.from(elements.values());

      for (const candidate of allElements) {
        if (candidate.id === focusedElementId) continue;

        const rect = candidate.element.getBoundingClientRect();
        if (!rect) continue;

        // Update cached rect
        candidate.rect = rect;

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const currentCx = currentRect.left + currentRect.width / 2;
        const currentCy = currentRect.top + currentRect.height / 2;

        let inDirection = false;
        let primaryDist = 0;
        let secondaryDist = 0;

        switch (direction) {
          case "up":
            inDirection = cy < currentRect.top;
            primaryDist = currentRect.top - (rect.top + rect.height);
            secondaryDist = Math.abs(cx - currentCx);
            break;
          case "down":
            inDirection = rect.top > currentRect.bottom;
            primaryDist = rect.top - currentRect.bottom;
            secondaryDist = Math.abs(cx - currentCx);
            break;
          case "left":
            inDirection = cx < currentRect.left;
            primaryDist = currentRect.left - (rect.left + rect.width);
            secondaryDist = Math.abs(cy - currentCy);
            break;
          case "right":
            inDirection = rect.left > currentRect.right;
            primaryDist = rect.left - currentRect.right;
            secondaryDist = Math.abs(cy - currentCy);
            break;
        }

        if (!inDirection) continue;

        // Score: prioritize elements closest in primary direction,
        // then break ties by secondary axis proximity
        const score = primaryDist * 2 + secondaryDist;

        if (score < bestScore) {
          bestScore = score;
          bestElement = candidate;
        }
      }

      if (bestElement) {
        lastFocusTime.current = now;
      }

      return bestElement;
    },
    [focusedElementId]
  );

  const navigate = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!focusedElementId) return;

      const current = focusableElements.get(focusedElementId);
      if (!current) return;

      const rect = current.element.getBoundingClientRect();
      const target = findElementInDirection(direction, rect, focusableElements);

      if (target) {
        setFocusedElementId(target.id);
        target.element.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    },
    [focusedElementId, focusableElements, findElementInDirection]
  );

  const select = useCallback(() => {
    if (!focusedElementId) return;
    const current = focusableElements.get(focusedElementId);
    if (current) {
      current.element.click();
    }
  }, [focusedElementId, focusableElements]);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  const exitControllerMode = useCallback(() => {
    dispatch(toggleControllerMode());
  }, [dispatch]);

  // Keyboard navigation (D-pad simulation via arrow keys)
  useEffect(() => {
    if (!isControllerMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          navigate("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          navigate("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigate("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate("right");
          break;
        case "Enter":
          e.preventDefault();
          select();
          break;
        case "Backspace":
        case "Escape":
          e.preventDefault();
          exitControllerMode();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isControllerMode, navigate, select, exitControllerMode]);

  // Gamepad polling with deduplication to prevent double-triggering
  useEffect(() => {
    if (!isControllerMode) return;

    let animationFrameId: number;
    const pollInterval = 50; // 20Hz polling
    let lastPollTime = 0;

    const pollGamepad = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(pollGamepad);

      if (timestamp - lastPollTime < pollInterval) return;
      lastPollTime = timestamp;

      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0]; // Primary gamepad
      if (!gamepad) return;

      const now = performance.now();
      const cooldownElapsed =
        now - lastFocusTime.current >= FOCUS_COOLDOWN;

      // D-pad or left stick axis navigation
      const dpadUp = gamepad.buttons[12]?.pressed;
      const dpadDown = gamepad.buttons[13]?.pressed;
      const dpadLeft = gamepad.buttons[14]?.pressed;
      const dpadRight = gamepad.buttons[15]?.pressed;

      // Left stick axis (threshold for deadzone)
      const AXIS_THRESHOLD = 0.5;
      const axisLeft = gamepad.axes[0] || 0;
      const axisUp = gamepad.axes[1] || 0;

      const stickUp = axisUp < -AXIS_THRESHOLD;
      const stickDown = axisUp > AXIS_THRESHOLD;
      const stickLeft = axisLeft < -AXIS_THRESHOLD;
      const stickRight = axisLeft > AXIS_THRESHOLD;

      // Face buttons: A=0, B=1, X=2, Y=3
      const buttonA = gamepad.buttons[0]?.pressed;
      const buttonB = gamepad.buttons[1]?.pressed;

      const buttons = {
        12: dpadUp,
        13: dpadDown,
        14: dpadLeft,
        15: dpadRight,
        0: buttonA,
        1: buttonB,
      };

      // Only process direction input if cooldown has elapsed
      if (cooldownElapsed) {
        if (dpadUp || stickUp) navigate("up");
        else if (dpadDown || stickDown) navigate("down");
        else if (dpadLeft || stickLeft) navigate("left");
        else if (dpadRight || stickRight) navigate("right");
        else if (buttonA) select();
        else if (buttonB) exitControllerMode();
      }

      // Update last-known state for edge detection
      lastGamepadState.current.buttons = buttons;
    };

    animationFrameId = requestAnimationFrame(pollGamepad);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isControllerMode, navigate, select, exitControllerMode]);

  const value = useMemo(
    () => ({
      isControllerMode,
      focusedElementId,
      setFocusedElementId,
      registerElement,
      unregisterElement,
      navigate,
      select,
      goBack,
      exitControllerMode,
    }),
    [
      isControllerMode,
      focusedElementId,
      registerElement,
      unregisterElement,
      navigate,
      select,
      goBack,
      exitControllerMode,
    ]
  );

  return (
    <ControllerFocusContext.Provider value={value}>
      {children}
    </ControllerFocusContext.Provider>
  );
}
