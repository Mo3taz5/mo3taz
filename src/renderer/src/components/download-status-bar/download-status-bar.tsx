import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DownloadIcon } from "@primer/octicons-react";
import { useDownload, useLibrary } from "@renderer/hooks";
import "./download-status-bar.scss";

export function DownloadStatusBar() {
  const navigate = useNavigate();
  const { library } = useLibrary();
  const { lastPacket, progress, downloadSpeed, eta } = useDownload();

  const game = useMemo(() => {
    if (!lastPacket?.gameId) return null;
    return library.find((item) => item.id === lastPacket.gameId) ?? null;
  }, [lastPacket?.gameId, library]);

  const isDownloading = useMemo(() => {
    return (
      lastPacket !== null &&
      lastPacket.progress !== null &&
      lastPacket.progress < 1
    );
  }, [lastPacket]);

  const handleClick = () => {
    navigate("/downloads");
  };

  if (!isDownloading || !lastPacket) {
    return null;
  }

  const progressPercent = Math.round((lastPacket.progress || 0) * 100);

  return (
    <motion.div
      className="download-status-bar"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      <div className="download-status-bar__container">
        <div className="download-status-bar__main">
          <div className="download-status-bar__icon">
            {game?.iconUrl ? (
              <img src={game.iconUrl} alt="" />
            ) : (
              <DownloadIcon size={20} />
            )}
          </div>

          <div className="download-status-bar__info">
            <span className="download-status-bar__title">{game?.title ?? "Download in progress"}</span>
            <div className="download-status-bar__stats">
              <span className="download-status-bar__progress">
                {progress}
              </span>
              {downloadSpeed && (
                <span className="download-status-bar__speed">{downloadSpeed}</span>
              )}
              {eta && (
                <span className="download-status-bar__eta">ETA: {eta}</span>
              )}
            </div>
          </div>

          <div className="download-status-bar__pill">
            <span className="download-status-bar__pill-label">Progress</span>
            <strong>{progressPercent}%</strong>
          </div>
        </div>

        <div className="download-status-bar__progress-track">
          <motion.div
            className="download-status-bar__progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
