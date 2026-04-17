import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GlobeIcon,
  TelescopeIcon,
  RepoIcon,
  DownloadIcon,
  GearIcon,
  BellIcon,
  PersonIcon,
  SearchIcon,
  HeartFillIcon,
  PinIcon,
} from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import {
  useLibrary,
  useDownload,
  useUserDetails,
  useAppSelector,
  useToast,
} from "@renderer/hooks";
import { AuthPage } from "@shared";
import { buildGameDetailsPath } from "@renderer/helpers";
import type { LibraryGame } from "@types";
import cn from "classnames";
import outputGif from "@renderer/assets/icons/output.gif";
import "./capsule-sidebar.scss";

interface NavItem {
  path: string;
  nameKey: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", nameKey: "home", icon: <GlobeIcon size={20} /> },
  {
    path: "/catalogue",
    nameKey: "catalogue",
    icon: <TelescopeIcon size={20} />,
  },
  { path: "/library", nameKey: "library", icon: <RepoIcon size={20} /> },
  {
    path: "/downloads",
    nameKey: "downloads",
    icon: <DownloadIcon size={20} />,
  },
  { path: "/settings", nameKey: "settings", icon: <GearIcon size={20} /> },
];

export function CapsuleSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("sidebar");
  const { library } = useLibrary();
  const { lastPacket } = useDownload();
  const { userDetails } = useUserDetails();
  const [isHovered, setIsHovered] = useState(false);
  const [isPhonkMode, setIsPhonkMode] = useState(false);
  const [_logoClickCount, setLogoClickCount] = useState(0);
  const [logoClickTimer, setLogoClickTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGamesList, setShowGamesList] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [_konamiIndex, _setKonamiIndex] = useState(0);
  const [_gifClickCount, _setGifClickCount] = useState(0);
  const [isGifExploding, setIsGifExploding] = useState(false);
  const friendRequestCount = useAppSelector(
    (state) => state.userDetails.friendRequestCount
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showSuccessToast } = useToast();

  const handleNavigation = useCallback(
    (path: string) => {
      if (path !== location.pathname) {
        navigate(path);
      }
      setShowGamesList(false);
      setShowFavorites(false);
    },
    [navigate, location.pathname]
  );

  const downloadIndicatorVisible = useMemo(() => {
    return lastPacket !== null;
  }, [lastPacket]);

  const unreadNotifications = useMemo(() => {
    return (friendRequestCount || 0) > 0;
  }, [friendRequestCount]);

  // Filtered games
  const filteredGames = useMemo(() => {
    if (!searchQuery) return library;
    return library.filter((game) =>
      game.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [library, searchQuery]);

  // Favorite games
  const favoriteGames = useMemo(() => {
    return library.filter((game) => game.favorite);
  }, [library]);

  // Pinned games
  const pinnedGames = useMemo(() => {
    return library.filter((game) => game.isPinned);
  }, [library]);

  // Handle game click
  const handleGameClick = useCallback(
    (game: LibraryGame) => {
      navigate(buildGameDetailsPath(game));
      setShowGamesList(false);
      setShowFavorites(false);
    },
    [navigate]
  );

  // Profile click handler
  const handleProfileClick = useCallback(() => {
    if (!userDetails) {
      window.electron.openAuthWindow(AuthPage.SignIn);
    } else {
      // Use userDetails.id (not userId)
      navigate(`/profile/${userDetails.id}`);
    }
  }, [userDetails, navigate]);

  // Search focus
  const handleSearchFocus = useCallback(() => {
    setShowGamesList(true);
    setShowFavorites(false);
  }, []);

  // Search blur - close if empty
  const handleSearchBlur = useCallback(() => {
    if (!searchQuery) {
      setShowGamesList(false);
    }
  }, [searchQuery]);

  // Search change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      setShowGamesList(value.length > 0);
      setShowFavorites(false);
    },
    []
  );

  // Favorites toggle
  const handleFavoritesClick = useCallback(() => {
    setShowFavorites((prev) => !prev);
    setShowGamesList(false);
    setShowPinned(false);
    setSearchQuery("");
  }, []);

  // Pinned games toggle
  const handlePinnedClick = useCallback(() => {
    setShowPinned((prev) => !prev);
    setShowGamesList(false);
    setShowFavorites(false);
    setSearchQuery("");
  }, []);

  // Notifications bell click
  const handleNotificationsClick = useCallback(() => {
    navigate("/notifications");
    setShowGamesList(false);
    setShowFavorites(false);
  }, [navigate]);

  // Word-based easter egg: type "scorpion" anywhere
  useEffect(() => {
    let typed = "";
    const MAGIC_WORD = "scorpion";

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      typed += e.key.toLowerCase();
      if (typed.length > MAGIC_WORD.length) {
        typed = typed.slice(-MAGIC_WORD.length);
      }

      if (typed === MAGIC_WORD) {
        typed = "";
        // Trigger scorpion rain!
        const rainArray = Array.from({ length: 30 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 2,
          emoji: "🦂",
        }));
        setMegaScorpions(rainArray);
        showSuccessToast("🦂 SCORPION RAIN! 🦂");
        setTimeout(() => setMegaScorpions([]), 3000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSuccessToast]);

  // GIF Easter egg trigger (original scorpion GIF)
  const handleGifClick = useCallback(() => {
    _setGifClickCount((prev) => {
      const newCount = prev + 1;
      setIsGifExploding(true);
      setTimeout(() => setIsGifExploding(false), 600);

      if (newCount >= 10) {
        // Scorpion rain!
        const rainArray = Array.from({ length: 30 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          delay: Math.random() * 2,
          emoji: "🦂",
        }));
        setMegaScorpions(rainArray);
        showSuccessToast("🦂 SCORPION RAIN! 🦂");
        setTimeout(() => setMegaScorpions([]), 3000);
        return 0;
      } else if (newCount >= 5) {
        showSuccessToast("🦂 Almost there... keep clicking!");
      } else if (newCount >= 3) {
        showSuccessToast("🦂 Click 10 times for a surprise!");
      }

      return newCount;
    });
  }, [showSuccessToast]);

  // Phonk mode trigger: triple-click logo
  const handleLogoClick = useCallback(() => {
    setLogoClickCount((prev) => {
      const newCount = prev + 1;

      if (logoClickTimer) clearTimeout(logoClickTimer);

      const timer = setTimeout(() => {
        setLogoClickCount(0);
      }, 800);

      setLogoClickTimer(timer);

      if (newCount === 3) {
        setIsPhonkMode((prev) => !prev);
        setLogoClickCount(0);
        if (logoClickTimer) clearTimeout(logoClickTimer);
      }

      return newCount;
    });
  }, [logoClickTimer]);

  // Apply phonk mode class to document
  useEffect(() => {
    if (isPhonkMode) {
      document.documentElement.classList.add("phonk-mode");
    } else {
      document.documentElement.classList.remove("phonk-mode");
    }
  }, [isPhonkMode]);

  return (
    <>
      {/* Scorpion rain container (easter egg) */}
      <ScorpionRain isPhonkMode={isPhonkMode} />

      <motion.nav
        className={cn("capsule-sidebar", {
          "capsule-sidebar--expanded":
            isHovered || showGamesList || showFavorites,
        })}
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          if (!showGamesList && !showFavorites) {
            setSearchQuery("");
          }
        }}
      >
        <div className="capsule-sidebar__container">
          {/* Profile Section */}
          <div className="capsule-sidebar__profile-section">
            <button
              type="button"
              className="capsule-sidebar__profile-avatar"
              onClick={handleProfileClick}
              aria-label={userDetails ? "View profile" : "Sign in"}
            >
              {userDetails?.profileImageUrl ? (
                <img src={userDetails.profileImageUrl} alt="Profile" />
              ) : (
                <div className="capsule-sidebar__avatar-placeholder">
                  <PersonIcon size={20} />
                </div>
              )}
            </button>
            <button
              type="button"
              className="capsule-sidebar__notification-bell"
              onClick={handleNotificationsClick}
              aria-label="Notifications"
            >
              <BellIcon size={18} />
              <AnimatePresence>
                {unreadNotifications && (
                  <motion.span
                    className="capsule-sidebar__notification-badge"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500 }}
                  />
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Divider */}
          <div className="capsule-sidebar__divider" />

          {/* Search Bar */}
          <div className="capsule-sidebar__search">
            <SearchIcon size={14} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t("search")}
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              className="capsule-sidebar__search-input"
            />
          </div>

          {/* Favorites Button */}
          <motion.button
            type="button"
            className={cn("capsule-sidebar__nav-item", {
              "capsule-sidebar__nav-item--active": showFavorites,
            })}
            onClick={handleFavoritesClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="capsule-sidebar__nav-icon">
              <HeartFillIcon
                size={18}
                className="capsule-sidebar__favorites-icon"
              />
            </span>
            <AnimatePresence>
              {(isHovered || showFavorites) && (
                <motion.span
                  className="capsule-sidebar__nav-label"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {t("favorites", { defaultValue: "Favorites" })}
                  {favoriteGames.length > 0 && (
                    <span className="capsule-sidebar__count-badge">
                      {favoriteGames.length}
                    </span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Pinned Games Button */}
          <motion.button
            type="button"
            className={cn("capsule-sidebar__nav-item", {
              "capsule-sidebar__nav-item--active": showPinned,
            })}
            onClick={handlePinnedClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="capsule-sidebar__nav-icon">
              <PinIcon size={18} className="capsule-sidebar__pinned-icon" />
            </span>
            <AnimatePresence>
              {(isHovered || showPinned) && (
                <motion.span
                  className="capsule-sidebar__nav-label"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {t("pinned", { defaultValue: "Pinned" })}
                  {pinnedGames.length > 0 && (
                    <span className="capsule-sidebar__count-badge">
                      {pinnedGames.length}
                    </span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Divider */}
          <div className="capsule-sidebar__divider" />

          {/* Navigation Items */}
          <div className="capsule-sidebar__nav-items">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <motion.button
                  key={item.path}
                  type="button"
                  className={cn("capsule-sidebar__nav-item", {
                    "capsule-sidebar__nav-item--active": isActive,
                  })}
                  onClick={() => handleNavigation(item.path)}
                  whileHover={{ scale: 1.2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  aria-label={t(item.nameKey)}
                >
                  <span className="capsule-sidebar__nav-icon">{item.icon}</span>
                  <AnimatePresence>
                    {isHovered && (
                      <motion.span
                        className="capsule-sidebar__nav-label"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                      >
                        {t(item.nameKey)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {downloadIndicatorVisible && item.path === "/downloads" && (
                    <motion.span
                      className="capsule-sidebar__download-dot"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500 }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Games List Dropdown */}
          <AnimatePresence>
            {showGamesList && (
              <motion.div
                className="capsule-sidebar__games-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="capsule-sidebar__games-list-header">
                  <span>{t("games", { defaultValue: "Games" })}</span>
                  <button
                    type="button"
                    className="capsule-sidebar__close-btn"
                    onClick={() => {
                      setShowGamesList(false);
                      setSearchQuery("");
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div className="capsule-sidebar__games-list-content">
                  {filteredGames.length === 0 ? (
                    <p className="capsule-sidebar__empty-state">
                      {searchQuery ? "No games found" : "No games in library"}
                    </p>
                  ) : (
                    filteredGames.slice(0, 20).map((game) => (
                      <button
                        key={game.id}
                        type="button"
                        className="capsule-sidebar__game-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleGameClick(game);
                        }}
                      >
                        {game.iconUrl && (
                          <img
                            src={game.iconUrl}
                            alt=""
                            className="capsule-sidebar__game-icon"
                          />
                        )}
                        <span className="capsule-sidebar__game-title">
                          {game.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Favorites List */}
          <AnimatePresence>
            {showFavorites && (
              <motion.div
                className="capsule-sidebar__games-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="capsule-sidebar__games-list-header">
                  <span>
                    ❤️ {t("favorites", { defaultValue: "Favorites" })}
                  </span>
                  <button
                    type="button"
                    className="capsule-sidebar__close-btn"
                    onClick={() => setShowFavorites(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="capsule-sidebar__games-list-content">
                  {favoriteGames.length === 0 ? (
                    <p className="capsule-sidebar__empty-state">
                      No favorites yet
                    </p>
                  ) : (
                    favoriteGames.map((game) => (
                      <button
                        key={game.id}
                        type="button"
                        className="capsule-sidebar__game-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleGameClick(game);
                        }}
                      >
                        {game.iconUrl && (
                          <img
                            src={game.iconUrl}
                            alt=""
                            className="capsule-sidebar__game-icon"
                          />
                        )}
                        <span className="capsule-sidebar__game-title">
                          {game.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pinned Games List */}
          <AnimatePresence>
            {showPinned && (
              <motion.div
                className="capsule-sidebar__games-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="capsule-sidebar__games-list-header">
                  <span>📌 {t("pinned", { defaultValue: "Pinned" })}</span>
                  <button
                    type="button"
                    className="capsule-sidebar__close-btn"
                    onClick={() => setShowPinned(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="capsule-sidebar__games-list-content">
                  {pinnedGames.length === 0 ? (
                    <p className="capsule-sidebar__empty-state">
                      No pinned games
                    </p>
                  ) : (
                    pinnedGames.map((game) => (
                      <button
                        key={game.id}
                        type="button"
                        className="capsule-sidebar__game-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleGameClick(game);
                        }}
                      >
                        {game.iconUrl && (
                          <img
                            src={game.iconUrl}
                            alt=""
                            className="capsule-sidebar__game-icon"
                          />
                        )}
                        <span className="capsule-sidebar__game-title">
                          {game.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Easter Egg Logo */}
          <div className="capsule-sidebar__divider" />
          <motion.button
            type="button"
            className="capsule-sidebar__logo-trigger"
            onClick={handleLogoClick}
            whileHover={{ scale: 1.05, rotate: isPhonkMode ? 5 : 0 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="capsule-sidebar__logo-text">M3</span>
          </motion.button>

          {/* Scorpion GIF Easter Egg */}
          <div
            className={cn("capsule-sidebar__gif-trigger", {
              "capsule-sidebar__gif--exploding": isGifExploding,
            })}
            onClick={handleGifClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleGifClick()}
          >
            <img src={outputGif} alt="Easter Egg" />
          </div>
        </div>
      </motion.nav>
    </>
  );
}

// Mega scorpions state for Konami code
let setMegaScorpions: React.Dispatch<
  React.SetStateAction<
    Array<{ id: number; x: number; delay: number; emoji: string }>
  >
> = () => {};

// Scorpion Rain Component
function ScorpionRain({ isPhonkMode }: { isPhonkMode: boolean }) {
  const [scorpions, setScorpions] = useState<
    Array<{ id: number; x: number; delay: number; emoji: string }>
  >([]);

  setMegaScorpions = setScorpions;

  // Expose to global for GIF trigger
  const handleLogoTrigger = useCallback(() => {
    const rainArray = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      emoji: "🦂",
    }));
    setScorpions(rainArray);
    setTimeout(() => {
      setScorpions([]);
    }, 3000);
  }, []);

  useEffect(() => {
    (window as any).__triggerScorpionRain = handleLogoTrigger;
    return () => {
      delete (window as any).__triggerScorpionRain;
    };
  }, [handleLogoTrigger]);

  if (scorpions.length === 0 && !isPhonkMode) return null;

  return (
    <div className="scorpion-rain" aria-hidden="true">
      {scorpions.map((scorpion) => (
        <motion.div
          key={scorpion.id}
          className="scorpion"
          initial={{ y: -50, opacity: 1, rotate: 0 }}
          animate={{
            y: window.innerHeight + 50,
            opacity: [1, 1, 0],
            rotate: 360,
          }}
          transition={{
            duration: 3,
            delay: scorpion.delay,
            ease: "linear",
          }}
          style={{ left: `${scorpion.x}%` }}
        >
          {scorpion.emoji}
        </motion.div>
      ))}
    </div>
  );
}
