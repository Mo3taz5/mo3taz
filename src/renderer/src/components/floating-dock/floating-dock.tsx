import { useCallback, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GlobeIcon,
  TelescopeIcon,
  RepoIcon,
  DownloadIcon,
  GearIcon,
} from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import { useDownload } from "@renderer/hooks";
import cn from "classnames";
import "./floating-dock.scss";

interface DockItem {
  path: string;
  nameKey: string;
  icon: React.ReactNode;
}

const DOCK_ITEMS: DockItem[] = [
  { path: "/", nameKey: "home", icon: <GlobeIcon size={22} /> },
  {
    path: "/catalogue",
    nameKey: "catalogue",
    icon: <TelescopeIcon size={22} />,
  },
  { path: "/library", nameKey: "library", icon: <RepoIcon size={22} /> },
  {
    path: "/downloads",
    nameKey: "downloads",
    icon: <DownloadIcon size={22} />,
  },
  { path: "/settings", nameKey: "settings", icon: <GearIcon size={22} /> },
];

const MAGNIFICATION_FACTOR = 1.6;
const BASE_ICON_SIZE = 28;

export function FloatingDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("sidebar");
  const { lastPacket } = useDownload();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleNavigation = useCallback(
    (path: string) => {
      if (path !== location.pathname) {
        navigate(path);
      }
    },
    [navigate, location.pathname]
  );

  const downloadIndicatorVisible = useMemo(() => {
    return lastPacket !== null;
  }, [lastPacket]);

  return (
    <motion.nav
      className="floating-dock"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.5 }}
    >
      <div
        className="floating-dock__container"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {DOCK_ITEMS.map((item, index) => {
          const isActive = location.pathname === item.path;
          const isHovered = hoveredIndex === index;

          return (
            <motion.button
              key={item.path}
              type="button"
              className={cn("floating-dock__item", {
                "floating-dock__item--active": isActive,
              })}
              onClick={() => handleNavigation(item.path)}
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              animate={{
                scale: isHovered ? MAGNIFICATION_FACTOR : 1,
                y: isHovered ? -8 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              aria-label={t(item.nameKey)}
            >
              <motion.div
                className="floating-dock__icon"
                animate={{
                  width: isHovered
                    ? BASE_ICON_SIZE * MAGNIFICATION_FACTOR
                    : BASE_ICON_SIZE,
                  height: isHovered
                    ? BASE_ICON_SIZE * MAGNIFICATION_FACTOR
                    : BASE_ICON_SIZE,
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
              >
                {item.icon}
                {downloadIndicatorVisible && item.path === "/downloads" && (
                  <motion.span
                    className="floating-dock__download-indicator"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500 }}
                  />
                )}
              </motion.div>
              <AnimatePresence>
                {isHovered && (
                  <motion.span
                    className="floating-dock__label"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                  >
                    {t(item.nameKey)}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
