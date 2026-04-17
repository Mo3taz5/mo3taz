import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GlobeIcon,
  TelescopeIcon,
  RepoIcon,
  DownloadIcon,
  GearIcon,
  SignOutIcon,
  PlayIcon,
} from "@primer/octicons-react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useLibrary } from "@renderer/hooks";
import { useControllerFocus } from "@renderer/context";
import { buildGameDetailsPath } from "@renderer/helpers";
import type { LibraryGame } from "@types";
import "./big-screen-layout.scss";
import { useTranslation } from "react-i18next";

const navItems = [
  { path: "/", icon: <GlobeIcon />, nameKey: "home" },
  { path: "/catalogue", icon: <TelescopeIcon />, nameKey: "catalogue" },
  { path: "/library", icon: <RepoIcon />, nameKey: "library" },
  { path: "/downloads", icon: <DownloadIcon />, nameKey: "downloads" },
  { path: "/settings", icon: <GearIcon />, nameKey: "settings" },
];

export default function BigScreenLayout() {
  const { t } = useTranslation("app");
  const { library } = useLibrary();
  const navigate = useNavigate();
  const location = useLocation();
  const { registerElement, unregisterElement, exitControllerMode } =
    useControllerFocus();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Games with downloads completed (have a download record with progress >= 1)
  // or games that have been played (have lastTimePlayed)
  const installedGames = useMemo(
    () =>
      library
        .filter((g) => g.lastTimePlayed)
        .sort((a, b) => {
          const aTime = a.lastTimePlayed ? new Date(a.lastTimePlayed).getTime() : 0;
          const bTime = b.lastTimePlayed ? new Date(b.lastTimePlayed).getTime() : 0;
          return bTime - aTime;
        }),
    [library]
  );

  // Recent games for hero
  const heroGame = useMemo(() => {
    return library
      .filter((g) => g.lastTimePlayed)
      .sort((a, b) => {
        const aTime = a.lastTimePlayed ? new Date(a.lastTimePlayed).getTime() : 0;
        const bTime = b.lastTimePlayed ? new Date(b.lastTimePlayed).getTime() : 0;
        return bTime - aTime;
      })[0];
  }, [library]);

  const handleCardClick = useCallback(
    (game: LibraryGame) => {
      navigate(buildGameDetailsPath(game));
    },
    [navigate]
  );

  const handleNavClick = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  const timeStr = useMemo(() => {
    return currentTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [currentTime]);

  const dateStr = useMemo(() => {
    return currentTime.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [currentTime]);

  return (
    <div className="big-screen">
      {/* Animated focus ring */}
      <FocusRing />

      {/* Navigation Bar */}
      <nav className="big-screen__nav">
        <div className="big-screen__nav-left">
          <div className="big-screen__logo">MO3TAZ</div>
          <div className="big-screen__nav-items">
            {navItems.map((item) => {
              const isActive =
                item.path === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.path);
              const focusableId = `nav-${item.path.replace(/\//g, "")}`;

              return (
                <FocusableButton
                  key={item.path}
                  id={focusableId}
                  registerElement={registerElement}
                  unregisterElement={unregisterElement}
                  className={`big-screen__nav-item ${isActive ? "big-screen__nav-item--active" : ""}`}
                  onClick={() => handleNavClick(item.path)}
                >
                  {item.icon}
                  {t(item.nameKey)}
                </FocusableButton>
              );
            })}
          </div>
        </div>

        <div className="big-screen__nav-right">
          <div className="big-screen__datetime">
            <div>{timeStr}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{dateStr}</div>
          </div>

          <FocusableButton
            id="nav-exit"
            registerElement={registerElement}
            unregisterElement={unregisterElement}
            className="big-screen__exit-btn"
            onClick={exitControllerMode}
          >
            <SignOutIcon />
            Exit Big Screen
          </FocusableButton>
        </div>
      </nav>

      {/* Content Area */}
      <div className="big-screen__content">
        {/* Hero Section */}
        {heroGame && (
          <div className="big-screen__section">
            <HeroCard
              game={heroGame}
              registerElement={registerElement}
              unregisterElement={unregisterElement}
            />
          </div>
        )}

        {/* Installed Games Grid */}
        <div className="big-screen__section">
          <h2 className="big-screen__section-title">Installed Games</h2>

          {installedGames.length === 0 ? (
            <div className="big-screen__empty">
              <RepoIcon />
              <h3>No games installed yet</h3>
              <p>
                Head to the Catalogue to discover and download games to your
                library.
              </p>
            </div>
          ) : (
            <div className="big-screen__game-grid">
              {installedGames.map((game) => (
                <GameCardFocusable
                  key={game.id}
                  game={game}
                  onClick={() => handleCardClick(game)}
                  registerElement={registerElement}
                  unregisterElement={unregisterElement}
                />
              ))}
            </div>
          )}
        </div>

        {/* All Games */}
        {library.length > installedGames.length && (
          <div className="big-screen__section">
            <h2 className="big-screen__section-title">All Games</h2>
            <div className="big-screen__game-grid">
              {library
                .filter((g) => !g.lastTimePlayed)
                .map((game) => (
                  <GameCardFocusable
                    key={game.id}
                    game={game}
                    onClick={() => handleCardClick(game)}
                    registerElement={registerElement}
                    unregisterElement={unregisterElement}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Focus Ring Component ---- */
function FocusRing() {
  const { focusedElementId } = useControllerFocus();

  const [ringStyle, setRingStyle] = useState<React.CSSProperties>({
    display: "none",
  });

  useEffect(() => {
    if (!focusedElementId) {
      setRingStyle({ display: "none" });
      return;
    }

    const el = document.querySelector(
      `[data-focusable-id="${focusedElementId}"]`
    ) as HTMLElement | null;

    if (!el) {
      setRingStyle({ display: "none" });
      return;
    }

    const rect = el.getBoundingClientRect();
    setRingStyle({
      display: "block",
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
    });
  }, [focusedElementId]);

  return (
    <motion.div
      className="big-screen__focus-ring"
      animate={{
        top: ringStyle.top,
        left: ringStyle.left,
        width: ringStyle.width,
        height: ringStyle.height,
        display: ringStyle.display,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.5,
      }}
    />
  );
}

/* ---- Focusable Button Wrapper ---- */
function FocusableButton({
  id,
  children,
  className,
  onClick,
  registerElement,
  unregisterElement,
}: {
  id: string;
  children: React.ReactNode;
  className: string;
  onClick: () => void;
  registerElement: (id: string, el: HTMLElement) => void;
  unregisterElement: (id: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ref.current) {
      registerElement(id, ref.current);
    }
    return () => unregisterElement(id);
  }, [id, registerElement, unregisterElement]);

  return (
    <button
      ref={ref}
      type="button"
      data-focusable-id={id}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/* ---- Hero Card ---- */
function HeroCard({
  game,
  registerElement,
  unregisterElement,
}: {
  game: LibraryGame;
  registerElement: (id: string, el: HTMLElement) => void;
  unregisterElement: (id: string) => void;
}) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const focusableId = "hero-card";

  useEffect(() => {
    if (ref.current) {
      registerElement(focusableId, ref.current);
    }
    return () => unregisterElement(focusableId);
  }, [focusableId, registerElement, unregisterElement]);

  const handlePlay = useCallback(() => {
    navigate(buildGameDetailsPath(game));
  }, [navigate, game]);

  return (
    <div
      ref={ref}
      data-focusable-id={focusableId}
      className="big-screen__hero"
      onClick={handlePlay}
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)`,
        }}
      />
      <div className="big-screen__hero__content">
        <div className="big-screen__hero__title">{game.title}</div>
        <div className="big-screen__hero__subtitle">Ready to Play</div>
        <button
          type="button"
          className="big-screen__hero__play-btn"
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
        >
          <PlayIcon />
          Play Now
        </button>
      </div>
    </div>
  );
}

/* ---- Game Card Focusable ---- */
function GameCardFocusable({
  game,
  onClick,
  registerElement,
  unregisterElement,
}: {
  game: LibraryGame;
  onClick: () => void;
  registerElement: (id: string, el: HTMLElement) => void;
  unregisterElement: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focusableId = `game-${game.id}`;

  useEffect(() => {
    if (ref.current) {
      registerElement(focusableId, ref.current);
    }
    return () => unregisterElement(focusableId);
  }, [focusableId, registerElement, unregisterElement]);

  const coverUrl = game.iconUrl || game.libraryHeroImageUrl || null;
  const isInstalled = !!game.lastTimePlayed;

  return (
    <div
      ref={ref}
      data-focusable-id={focusableId}
      className="big-screen__game-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {coverUrl ? (
        <>
          <img
            src={coverUrl}
            alt={game.title}
            className="big-screen__game-card__image"
            loading="lazy"
          />
          <div className="big-screen__game-card__overlay">
            <div className="big-screen__game-card__title">{game.title}</div>
            <div className="big-screen__game-card__meta">
              <span
                className={`big-screen__game-card__badge ${
                  isInstalled
                    ? "big-screen__game-card__badge--installed"
                    : "big-screen__game-card__badge--available"
                }`}
              >
                {isInstalled ? "Installed" : "Available"}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="big-screen__game-card__placeholder">
          <RepoIcon />
        </div>
      )}
    </div>
  );
}
