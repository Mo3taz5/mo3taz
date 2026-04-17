import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SearchIcon,
  HomeIcon,
  PackageIcon,
  GlobeIcon,
  DownloadIcon,
  GearIcon,
  PersonIcon,
  SignOutIcon,
} from "@primer/octicons-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthPage, CatalogueCategory } from "@shared";
import {
  useAppDispatch,
  useAppSelector,
  useUserDetails,
} from "@renderer/hooks";
import { useHomeCatalogue } from "@renderer/hooks/use-home-catalogue";
import { setFilters, setLibrarySearchQuery } from "@renderer/features";
import { buildGameDetailsPath } from "@renderer/helpers";
import { Button, GameCard, Hero } from "@renderer/components";
import { useControllerLayout } from "@renderer/hooks";
import outputGif from "@renderer/assets/icons/output.gif";
import buttonA from "@renderer/assets/icons/bigscreen-a.png";
import buttonB from "@renderer/assets/icons/bigscreen-b.png";
import buttonY from "@renderer/assets/icons/bigscreen-y.png";
import buttonHome from "@renderer/assets/icons/bigscreen-home.png";
import buttonX from "@renderer/assets/icons/x.png";
import enterSoundFile from "@renderer/assets/audio/achievement.wav";
import sectionMoveSound from "@renderer/assets/audio/big-screen-sections.mp3";
import gameMoveSound from "@renderer/assets/audio/big-screen-games.mp3";
import "./big-screen-layout.scss";

type TabKey = "home" | "library" | "store" | "downloads" | "settings";
type Direction = "up" | "down" | "left" | "right";

type TabItem = {
  key: TabKey;
  label: string;
  path: string;
};

type MenuItem =
  | { key: TabKey; label: string; icon: JSX.Element; path: string }
  | { key: "profile"; label: string; icon: JSX.Element; action: "profile" }
  | { key: "exit"; label: string; icon: JSX.Element; action: "exit" };

const TABS: TabItem[] = [
  { key: "home", label: "HOME", path: "/" },
  { key: "library", label: "LIBRARY", path: "/library" },
  { key: "store", label: "STORE", path: "/catalogue" },
  { key: "downloads", label: "DOWNLOADS", path: "/downloads" },
  { key: "settings", label: "SETTINGS", path: "/settings" },
];

function isPathActive(current: string, path: string) {
  return path === "/" ? current === "/" : current.startsWith(path);
}

function tabIndexFromPath(pathname: string) {
  const idx = TABS.findIndex((tab) => isPathActive(pathname, tab.path));
  return idx >= 0 ? idx : 0;
}

const BIGSCREEN_FOCUS_SELECTOR = [
  ".big-screen__search-icon",
  ".big-screen__search-input",
  ".big-screen__tab",
  ".big-screen__profile",
  ".big-screen-home__chip",
  ".big-screen-home__browse",
  ".big-screen-home__banner",
  ".big-screen-home__card",
  ".big-screen__menu-item",
  ".big-screen__page-host button",
  ".big-screen__page-host a",
  ".big-screen__page-host input",
  ".big-screen__page-host [role='button']",
  ".big-screen__page-host [tabindex='0']",
].join(",");

export default function BigScreenLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { userDetails } = useUserDetails();
  const controllerLayoutPreference = useAppSelector(
    (state) => state.userPreferences.value?.controllerLayout
  );
  const { t } = useTranslation([
    "header",
    "home",
    "settings",
    "user_profile",
    "game_details",
  ]);
  const { resolvedLayout: controllerLayout } = useControllerLayout(
    controllerLayoutPreference ?? "auto"
  );

  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMenu, setShowMenu] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [tabIndex, setTabIndex] = useState(() =>
    tabIndexFromPath(location.pathname)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isBooting, setIsBooting] = useState(true);

  const showMenuRef = useRef(showMenu);
  const menuIndexRef = useRef(menuIndex);
  const tabIndexRef = useRef(tabIndex);
  const gamepadState = useRef<Record<number, boolean>>({});
  const pageHostRef = useRef<HTMLElement | null>(null);
  const focusIndexRef = useRef(0);
  const lastPathRef = useRef(location.pathname);

  const playNavigateSound = useCallback(() => {
    try {
      const audio = new Audio(gameMoveSound);
      audio.volume = 0.22;
      void audio.play();
    } catch {
      // Ignore
    }
  }, []);

  const playSelectSound = useCallback(() => {
    try {
      const audio = new Audio(sectionMoveSound);
      audio.volume = 0.22;
      void audio.play();
    } catch {
      // Ignore
    }
  }, []);

  const playEnterSound = useCallback(() => {
    try {
      const audio = new Audio(enterSoundFile);
      audio.volume = 0.22;
      void audio.play();
    } catch {
      // Ignore
    }
  }, []);

  const focusElements = useCallback((): HTMLElement[] => {
    const all = Array.from(
      document.querySelectorAll(BIGSCREEN_FOCUS_SELECTOR)
    ) as HTMLElement[];
    return all.filter((el) => {
      if (el.classList.contains("big-screen__footer-button")) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }, []);

  const getInitialFocusTarget = useCallback((): HTMLElement | null => {
    const all = focusElements();
    const pageHost = pageHostRef.current;
    const pageCandidates = pageHost
      ? all.filter((el) => pageHost.contains(el))
      : [];
    const candidates = pageCandidates.length > 0 ? pageCandidates : all;

    return (
      candidates.find(
        (el) => el.tagName !== "INPUT" && el.tagName !== "TEXTAREA"
      ) ??
      candidates[0] ??
      null
    );
  }, [focusElements]);

  const moveFocusDirectional = useCallback(
    (direction: Direction) => {
      const els = focusElements();
      if (!els.length) return;

      const active = document.activeElement as HTMLElement | null;
      const baseEl =
        (active && els.find((el) => el === active)) ||
        els[focusIndexRef.current] ||
        els[0];
      if (!baseEl) return;

      const baseRect = baseEl.getBoundingClientRect();
      const baseX = baseRect.left + baseRect.width / 2;
      const baseY = baseRect.top + baseRect.height / 2;

      let bestIndex = -1;
      let bestScore = Number.POSITIVE_INFINITY;

      els.forEach((candidate, idx) => {
        if (candidate === baseEl) return;

        const rect = candidate.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const dx = x - baseX;
        const dy = y - baseY;

        const inDirection =
          (direction === "left" && dx < -8) ||
          (direction === "right" && dx > 8) ||
          (direction === "up" && dy < -8) ||
          (direction === "down" && dy > 8);

        if (!inDirection) return;

        const mainDist =
          direction === "left" || direction === "right"
            ? Math.abs(dx)
            : Math.abs(dy);
        const crossDist =
          direction === "left" || direction === "right"
            ? Math.abs(dy)
            : Math.abs(dx);
        const score = mainDist + crossDist * 0.45;

        if (score < bestScore) {
          bestScore = score;
          bestIndex = idx;
        }
      });

      if (bestIndex < 0) return;

      focusIndexRef.current = bestIndex;
      els[bestIndex]?.focus();
      playNavigateSound();
    },
    [focusElements, playNavigateSound]
  );

  const clickFocused = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;

    if (active.tagName === "INPUT" || active.tagName === "TEXTAREA") return;
    active.click();
    playSelectSound();
  }, [playSelectSound]);

  const openFocusedOptionsMenu = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    if (
      !active ||
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA"
    ) {
      return;
    }

    active.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
    playSelectSound();
  }, [playSelectSound]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTabIndex(tabIndexFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    showMenuRef.current = showMenu;
  }, [showMenu]);

  useEffect(() => {
    menuIndexRef.current = menuIndex;
  }, [menuIndex]);

  useEffect(() => {
    tabIndexRef.current = tabIndex;
  }, [tabIndex]);

  useEffect(() => {
    pageHostRef.current = document.querySelector(
      ".big-screen__page-host"
    ) as HTMLElement | null;
  }, []);

  useEffect(() => {
    if (isBooting) return;

    const timer = window.setTimeout(() => {
      const all = focusElements();
      const target = getInitialFocusTarget();

      if (target) {
        const targetIndex = all.indexOf(target);
        if (targetIndex >= 0) {
          focusIndexRef.current = targetIndex;
          target.focus();
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [focusElements, getInitialFocusTarget, isBooting, location.pathname]);

  useEffect(() => {
    const on = async () => {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // ignore
        }
      }
    };

    void on();

    playEnterSound();

    const bootTimer = setTimeout(() => {
      setIsBooting(false);
      setTimeout(() => {
        getInitialFocusTarget()?.focus();
      }, 0);
    }, 1800);

    return () => {
      clearTimeout(bootTimer);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, [getInitialFocusTarget, playEnterSound]);

  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      playNavigateSound();
      lastPathRef.current = location.pathname;
    }
  }, [location.pathname, playNavigateSound]);

  const menuItems = useMemo<MenuItem[]>(() => {
    return [
      {
        key: "home",
        label: t("home", { ns: "header" }),
        icon: <HomeIcon />,
        path: "/",
      },
      {
        key: "library",
        label: t("library", { ns: "header" }),
        icon: <PackageIcon />,
        path: "/library",
      },
      {
        key: "store",
        label: t("catalogue", { ns: "header" }),
        icon: <GlobeIcon />,
        path: "/catalogue",
      },
      {
        key: "downloads",
        label: t("downloads", { ns: "header" }),
        icon: <DownloadIcon />,
        path: "/downloads",
      },
      {
        key: "settings",
        label: t("settings", { ns: "header" }),
        icon: <GearIcon />,
        path: "/settings",
      },
      {
        key: "profile",
        label: userDetails
          ? t("see_profile", { ns: "user_profile" })
          : t("sign_in", { ns: "user_profile" }),
        icon: <PersonIcon />,
        action: "profile",
      },
      {
        key: "exit",
        label: t("sign_out", { ns: "user_profile" }),
        icon: <SignOutIcon />,
        action: "exit",
      },
    ];
  }, [t, userDetails]);

  const clockText = useMemo(
    () =>
      currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [currentTime]
  );

  const controllerButtonLabels = useMemo(() => {
    if (controllerLayout === "playstation") {
      return {
        select: "Cross",
        home: "Circle",
        options: "Square",
        search: "Triangle",
        optionsHint: "Square",
      };
    }

    return {
      select: "A",
      home: "B",
      options: "X",
      search: "Y",
      optionsHint: "X",
    };
  }, [controllerLayout]);

  const openProfileOrSignIn = useCallback(() => {
    if (userDetails?.id) {
      navigate(`/profile/${userDetails.id}`);
      return;
    }

    window.electron.openAuthWindow(AuthPage.SignIn);
  }, [navigate, userDetails]);

  const exitBigScreen = useCallback(() => {
    window.dispatchEvent(new CustomEvent("exit-big-screen"));
  }, []);

  const openMenu = useCallback(() => {
    const currentIndex = menuItems.findIndex(
      (item) => "path" in item && isPathActive(location.pathname, item.path)
    );
    setMenuIndex(currentIndex >= 0 ? currentIndex : 0);
    setShowMenu(true);
    playNavigateSound();
  }, [location.pathname, menuItems, playNavigateSound]);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
    playNavigateSound();
  }, [playNavigateSound]);

  const handleMenuSelect = useCallback(
    (idx: number) => {
      const item = menuItems[idx];
      if (!item) return;

      playSelectSound();

      if ("path" in item) {
        navigate(item.path);
        closeMenu();
        return;
      }

      if (item.action === "profile") {
        openProfileOrSignIn();
        closeMenu();
        return;
      }

      if (item.action === "exit") {
        exitBigScreen();
      }
    },
    [
      menuItems,
      navigate,
      closeMenu,
      openProfileOrSignIn,
      exitBigScreen,
      playSelectSound,
    ]
  );

  const switchTab = useCallback(
    (idx: number) => {
      const normalized = (idx + TABS.length) % TABS.length;
      setTabIndex(normalized);
      navigate(TABS[normalized].path);
      playNavigateSound();
    },
    [navigate, playNavigateSound]
  );

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      switchTab(tabIndexRef.current + direction);
    },
    [switchTab]
  );

  const applySearchValue = useCallback(
    (query: string) => {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        if (isPathActive(location.pathname, "/library")) {
          dispatch(setLibrarySearchQuery(""));
        } else if (isPathActive(location.pathname, "/catalogue")) {
          dispatch(setFilters({ title: "" }));
        }
        return;
      }

      if (isPathActive(location.pathname, "/library")) {
        dispatch(setLibrarySearchQuery(normalizedQuery));
        return;
      }

      dispatch(setFilters({ title: normalizedQuery }));

      if (!isPathActive(location.pathname, "/catalogue")) {
        navigate("/catalogue");
      }
    },
    [dispatch, location.pathname, navigate]
  );

  const applySearch = useCallback(() => {
    playSelectSound();
    applySearchValue(searchQuery);
  }, [applySearchValue, playSelectSound, searchQuery]);

  const isHomePage = location.pathname === "/";
  const isSettingsPage = isPathActive(location.pathname, "/settings");

  useEffect(() => {
    if (isBooting) return;

    const timer = window.setTimeout(() => {
      applySearchValue(searchQuery);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [applySearchValue, isBooting, searchQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isBooting) return;

      const inTextField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      if (showMenuRef.current) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMenuIndex((p) => Math.max(0, p - 1));
          playNavigateSound();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMenuIndex((p) => Math.min(menuItems.length - 1, p + 1));
          playNavigateSound();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          handleMenuSelect(menuIndexRef.current);
          return;
        }
        if (e.key === "Escape" || e.key === "Backspace") {
          e.preventDefault();
          closeMenu();
          return;
        }
      }

      if (e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openMenu();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (e.key === "/" && !inTextField) {
        e.preventDefault();
        const input = document.querySelector(
          ".big-screen__search-input"
        ) as HTMLInputElement | null;
        input?.focus();
        playNavigateSound();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveFocusDirectional("left");
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveFocusDirectional("right");
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveFocusDirectional("up");
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveFocusDirectional("down");
        return;
      }

      if (e.key === "PageUp" || e.key.toLowerCase() === "q") {
        e.preventDefault();
        cycleTab(-1);
        playSelectSound();
        return;
      }

      if (e.key === "PageDown" || e.key.toLowerCase() === "e") {
        e.preventDefault();
        cycleTab(1);
        playSelectSound();
        return;
      }

      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        openFocusedOptionsMenu();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        clickFocused();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    isBooting,
    location.pathname,
    cycleTab,
    openMenu,
    closeMenu,
    handleMenuSelect,
    menuItems.length,
    moveFocusDirectional,
    clickFocused,
    openFocusedOptionsMenu,
    playNavigateSound,
  ]);

  useEffect(() => {
    const unsubscribe = window.electron.onBigScreenEscape(() => {
      if (showMenuRef.current) {
        closeMenu();
        return;
      }

      openMenu();
    });

    return () => unsubscribe();
  }, [closeMenu, openMenu]);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (isBooting) return;

      const gp = navigator.getGamepads?.()[0];
      if (!gp) return;

      const pressed = {
        0: Boolean(gp.buttons[0]?.pressed),
        1: Boolean(gp.buttons[1]?.pressed),
        2: Boolean(gp.buttons[2]?.pressed),
        3: Boolean(gp.buttons[3]?.pressed),
        4: Boolean(gp.buttons[4]?.pressed),
        5: Boolean(gp.buttons[5]?.pressed),
        8: Boolean(gp.buttons[8]?.pressed),
        9: Boolean(gp.buttons[9]?.pressed),
        12: Boolean(gp.buttons[12]?.pressed),
        13: Boolean(gp.buttons[13]?.pressed),
        14: Boolean(gp.buttons[14]?.pressed),
        15: Boolean(gp.buttons[15]?.pressed),
        16: Boolean(gp.buttons[16]?.pressed),
      };

      const edge = (b: number) => pressed[b] && !gamepadState.current[b];

      if (edge(8) || edge(9) || edge(16)) {
        if (showMenuRef.current) closeMenu();
        else openMenu();
      }

      if (showMenuRef.current) {
        if (edge(12)) {
          setMenuIndex((p) => Math.max(0, p - 1));
          playNavigateSound();
        }
        if (edge(13)) {
          setMenuIndex((p) => Math.min(menuItems.length - 1, p + 1));
          playNavigateSound();
        }
        if (edge(0)) handleMenuSelect(menuIndexRef.current);
        if (edge(1)) closeMenu();
      } else {
        if (edge(4)) cycleTab(-1);
        if (edge(5)) cycleTab(1);
        if (edge(12)) moveFocusDirectional("up");
        if (edge(13)) moveFocusDirectional("down");
        if (edge(14)) moveFocusDirectional("left");
        if (edge(15)) moveFocusDirectional("right");
        if (edge(0)) clickFocused();
        if (edge(1)) openMenu();
        if (edge(2)) openFocusedOptionsMenu();
        if (edge(3)) {
          const input = document.querySelector(
            ".big-screen__search-input"
          ) as HTMLInputElement | null;
          input?.focus();
          playNavigateSound();
        }
      }

      const axisY = gp.axes[1] || 0;
      if (Math.abs(axisY) > 0.65 && pageHostRef.current) {
        pageHostRef.current.scrollBy({
          top: axisY > 0 ? 18 : -18,
          behavior: "auto",
        });
      }

      gamepadState.current = pressed;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    isBooting,
    cycleTab,
    openMenu,
    closeMenu,
    menuItems.length,
    handleMenuSelect,
    moveFocusDirectional,
    clickFocused,
    playNavigateSound,
  ]);

  return (
    <div className="big-screen">
      <div className="big-screen__bg" />

      <header className="big-screen__topbar">
        <div className="big-screen__search-wrap">
          <button
            type="button"
            className="big-screen__search-icon"
            onClick={applySearch}
          >
            <SearchIcon />
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applySearch();
              }
            }}
            placeholder={t("search", { ns: "header" })}
            className="big-screen__search-input"
          />
        </div>

        <nav className="big-screen__tabs">
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              type="button"
              className={`big-screen__tab ${isPathActive(location.pathname, tab.path) ? "big-screen__tab--active" : ""}`}
              onClick={() => {
                switchTab(idx);
                playSelectSound();
              }}
            >
              {t(tab.key, { ns: "header" })}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="big-screen__profile"
          onClick={openProfileOrSignIn}
        >
          {userDetails?.profileImageUrl ? (
            <img
              src={userDetails.profileImageUrl}
              alt={
                userDetails.displayName ||
                t("see_profile", { ns: "user_profile" })
              }
            />
          ) : (
            <div className="big-screen__profile-ph">
              {(
                userDetails?.displayName || t("sign_in", { ns: "user_profile" })
              )
                .slice(0, 1)
                .toUpperCase()}
            </div>
          )}
          <div className="big-screen__profile-meta">
            <strong>
              {userDetails?.displayName || t("sign_in", { ns: "user_profile" })}
            </strong>
            <span>{clockText}</span>
          </div>
        </button>
      </header>

      <section
        className={`big-screen__page-host ${isSettingsPage ? "big-screen__page-host--settings" : ""}`}
      >
        {isHomePage ? (
          <BigScreenHomePanel
            goToCatalogue={() => switchTab(2)}
            onCategoryChange={playSelectSound}
          />
        ) : (
          <Outlet />
        )}
      </section>

      <footer className="big-screen__footer">
        <div className="big-screen__footer-buttons">
          <button
            type="button"
            tabIndex={-1}
            className="big-screen__footer-button"
            onClick={openMenu}
          >
            <img src={buttonHome} alt={t("options", { ns: "game_details" })} />
            <span>
              {controllerButtonLabels.options}{" "}
              {t("options", { ns: "game_details" })}
            </span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="big-screen__footer-button"
            onClick={clickFocused}
          >
            <img src={buttonA} alt={t("select", { ns: "settings" })} />
            <span>
              {controllerButtonLabels.select} {t("select", { ns: "settings" })}
            </span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="big-screen__footer-button"
            onClick={() => switchTab(0)}
          >
            <img src={buttonB} alt={t("home", { ns: "header" })} />
            <span>
              {controllerButtonLabels.home} {t("home", { ns: "header" })}
            </span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="big-screen__footer-button"
            onClick={openFocusedOptionsMenu}
          >
            <img src={buttonX} alt={t("options", { ns: "game_details" })} />
            <span>
              {controllerButtonLabels.options}{" "}
              {t("options", { ns: "game_details" })}
            </span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="big-screen__footer-button"
            onClick={() => {
              const input = document.querySelector(
                ".big-screen__search-input"
              ) as HTMLInputElement | null;
              input?.focus();
              playNavigateSound();
            }}
          >
            <img src={buttonY} alt={t("search", { ns: "header" })} />
            <span>
              {controllerButtonLabels.search} {t("search", { ns: "header" })}
            </span>
          </button>
        </div>
        <span className="big-screen__hints">
          D-PAD • LB/RB • {controllerButtonLabels.optionsHint} • F2
        </span>
      </footer>

      {showMenu && (
        <div className="big-screen__menu-layer" onClick={closeMenu}>
          <div
            className="big-screen__menu"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t("options", { ns: "game_details" })}</h3>
            <div className="big-screen__menu-list">
              {menuItems.map((item, idx) => (
                <button
                  key={item.key}
                  type="button"
                  className={`big-screen__menu-item ${idx === menuIndex ? "big-screen__menu-item--active" : ""}`}
                  onMouseEnter={() => {
                    setMenuIndex(idx);
                    playNavigateSound();
                  }}
                  onClick={() => handleMenuSelect(idx)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isBooting && (
        <div className="big-screen__boot">
          <img src={outputGif} alt="MO3TAZ" className="big-screen__boot-gif" />
          <h2>MO3TAZ BIG SCREEN</h2>
          <p>{t("loading", { ns: "header" })}</p>
          <div className="big-screen__boot-buttons">
            <span>
              <img src={buttonA} alt={controllerButtonLabels.select} />{" "}
              {controllerButtonLabels.select} {t("select", { ns: "settings" })}
            </span>
            <span>
              <img src={buttonB} alt={controllerButtonLabels.home} />{" "}
              {controllerButtonLabels.home} {t("home", { ns: "header" })}
            </span>
            <span>
              <img src={buttonHome} alt={controllerButtonLabels.options} />{" "}
              {controllerButtonLabels.options}{" "}
              {t("options", { ns: "game_details" })}
            </span>
            <span>
              <b>LB/RB</b>
            </span>
            <span>
              <img src={buttonX} alt={controllerButtonLabels.options} />{" "}
              {controllerButtonLabels.options}{" "}
              {t("options", { ns: "game_details" })}
            </span>
            <span>
              <img src={buttonY} alt={controllerButtonLabels.search} />{" "}
              {controllerButtonLabels.search} {t("search", { ns: "header" })}
            </span>
            <span>
              <b>F2</b> {t("options", { ns: "game_details" })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function BigScreenHomePanel({
  goToCatalogue,
  onCategoryChange,
}: {
  goToCatalogue: () => void;
  onCategoryChange: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation(["home", "header"]);
  const {
    catalogue,
    allGames,
    currentCatalogueCategory,
    setCurrentCatalogueCategory,
    isLoading,
  } = useHomeCatalogue();

  const handleGameHover = useCallback(() => {
    try {
      const audio = new Audio(gameMoveSound);
      audio.volume = 0.12;
      void audio.play();
    } catch {
      // Ignore
    }
  }, []);

  const sectionTitle =
    currentCatalogueCategory === CatalogueCategory.Hot
      ? t("hot", { ns: "home" })
      : currentCatalogueCategory === CatalogueCategory.Weekly
        ? t("weekly", { ns: "home" })
        : t("achievements", { ns: "home" });

  return (
    <div className="big-screen-home">
      <Hero games={allGames} isLoading={isLoading} />

      <div className="big-screen-home__top">
        <div className="big-screen-home__chips">
          <button
            type="button"
            className={`big-screen-home__chip ${currentCatalogueCategory === CatalogueCategory.Hot ? "big-screen-home__chip--active" : ""}`}
            onClick={() => {
              setCurrentCatalogueCategory(CatalogueCategory.Hot);
              onCategoryChange();
            }}
          >
            {t("hot", { ns: "home" })}
          </button>
          <button
            type="button"
            className={`big-screen-home__chip ${currentCatalogueCategory === CatalogueCategory.Weekly ? "big-screen-home__chip--active" : ""}`}
            onClick={() => {
              setCurrentCatalogueCategory(CatalogueCategory.Weekly);
              onCategoryChange();
            }}
          >
            {t("weekly", { ns: "home" })}
          </button>
          <button
            type="button"
            className={`big-screen-home__chip ${currentCatalogueCategory === CatalogueCategory.Achievements ? "big-screen-home__chip--active" : ""}`}
            onClick={() => {
              setCurrentCatalogueCategory(CatalogueCategory.Achievements);
              onCategoryChange();
            }}
          >
            {t("achievements", { ns: "home" })}
          </button>
        </div>

        <Button
          theme="outline"
          className="big-screen-home__browse"
          onClick={goToCatalogue}
        >
          {t("catalogue", { ns: "header" })}
        </Button>
      </div>

      <div className="big-screen-home__head">
        <h3>{sectionTitle}</h3>
      </div>

      <div className="big-screen-home__grid">
        {isLoading
          ? Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="big-screen-home__card big-screen-home__card--loading"
              />
            ))
          : catalogue[currentCatalogueCategory].map((result) => (
              <GameCard
                key={result.objectId}
                game={result}
                onClick={() => navigate(buildGameDetailsPath(result))}
                onMouseEnter={handleGameHover}
                className="big-screen-home__game-card"
              />
            ))}
      </div>
    </div>
  );
}
