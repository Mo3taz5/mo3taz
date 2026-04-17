import { useState, useEffect } from "react";
import { useToast } from "@renderer/hooks";
import { levelDBService } from "@renderer/services/leveldb.service";
import {
  DownloadIcon,
  CopyIcon,
  DeviceDesktopIcon,
  ZapIcon,
  CalendarIcon,
  StarIcon,
  LinkExternalIcon,
  CheckCircleIcon,
  SyncIcon,
} from "@primer/octicons-react";
import { availableSources, type AvailableSource } from "./available-sources";
import { logger } from "@renderer/logger";
import "./source-cards.scss";

interface SourceCardProps {
  source: AvailableSource;
  isInstalled: boolean;
  onInstall: (source: AvailableSource) => Promise<void>;
  isInstalling: boolean;
}

function SourceCard({ source, isInstalled, onInstall, isInstalling }: SourceCardProps) {
  return (
    <div className="source-card group">
      <div className="source-card__header">
        <div className="source-card__info">
          <h3 className="source-card__title">{source.name}</h3>
          <p className="source-card__description">{source.description}</p>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-card__view-btn"
          title="View Source"
        >
          <LinkExternalIcon size={12} />
          <span className="source-card__view-text">View</span>
        </a>
      </div>

      <div className="source-card__stats-section">
        <div className="source-card__badges">
          {source.status && (
            <span
              className={`source-card__status-badge ${
                source.status === "Trusted"
                  ? "source-card__status-badge--trusted"
                  : source.status === "Untrusted"
                  ? "source-card__status-badge--untrusted"
                  : "source-card__status-badge--unknown"
              }`}
            >
              {source.status}
            </span>
          )}
        </div>

        <div className="source-card__stats">
          {source.gamesCount && (
            <div className="source-card__stat">
              <DeviceDesktopIcon size={12} />
              <span>{source.gamesCount}</span>
            </div>
          )}
          {source.downloadsCount && (
            <div className="source-card__stat">
              <DownloadIcon size={12} />
              <span>{source.downloadsCount}</span>
            </div>
          )}
          {source.copiesCount && (
            <div className="source-card__stat">
              <CopyIcon size={12} />
              <span>{source.copiesCount}</span>
            </div>
          )}
          {source.activeUsers && (
            <div className="source-card__stat">
              <ZapIcon size={12} />
              <span>{source.activeUsers}</span>
            </div>
          )}
        </div>
      </div>

      <div className="source-card__footer">
        <div className="source-card__meta">
          {source.addedDate && (
            <div className="source-card__meta-item">
              <CalendarIcon size={12} />
              <span>{source.addedDate}</span>
            </div>
          )}
          {source.rating && (
            <div className="source-card__meta-item">
              <StarIcon size={12} className="source-card__star-icon" />
              <span>
                {source.rating} ({source.ratingCount})
              </span>
            </div>
          )}
        </div>

        <div className="source-card__actions">
          {isInstalled ? (
            <button className="source-card__install-btn source-card__install-btn--installed" disabled>
              <CheckCircleIcon size={12} />
              <span>Installed</span>
            </button>
          ) : (
            <button
              className="source-card__install-btn"
              onClick={() => onInstall(source)}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <SyncIcon size={12} className="source-card__spinner" />
              ) : (
                <DownloadIcon size={12} />
              )}
              <span>{isInstalling ? "Installing..." : "Install"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SourceCards() {
  const { showSuccessToast, showErrorToast } = useToast();
  const [installedSourceUrls, setInstalledSourceUrls] = useState<Set<string>>(new Set());
  const [installingSource, setInstallingSource] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstalledSources = async () => {
      try {
        const sources = (await levelDBService.values("downloadSources")) as any[];
        const urls = new Set(sources.map((s: any) => s.url));
        setInstalledSourceUrls(urls);
      } catch (error) {
        logger.error("Failed to fetch installed sources:", error);
      }
    };

    fetchInstalledSources();
  }, []);

  const handleInstall = async (source: AvailableSource) => {
    setInstallingSource(source.id);

    try {
      // Add source directly using the new direct method (same as "Add a source" but without the modal)
      await window.electron.addDownloadSourceDirect(source.url, source.name);

      // Update installed sources list
      setInstalledSourceUrls((prev) => new Set(prev).add(source.url));

      showSuccessToast(`"${source.name}" installed successfully`);
    } catch (error) {
      logger.error("Failed to install source:", error);
      const errorMessage =
        error instanceof Error && error.message.includes("already exists")
          ? `"${source.name}" is already installed`
          : `Failed to install "${source.name}"`;

      showErrorToast(errorMessage);
    } finally {
      setInstallingSource(null);
    }
  };

  return (
    <div className="source-cards-section">
      <h2 className="source-cards-section__title">Available Download Sources</h2>
      <p className="source-cards-section__description">
        Browse and install available download sources directly to your launcher. Click "Install" to add a source.
      </p>

      <div className="source-cards-grid">
        {availableSources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            isInstalled={installedSourceUrls.has(source.url)}
            onInstall={handleInstall}
            isInstalling={installingSource === source.id}
          />
        ))}
      </div>
    </div>
  );
}
