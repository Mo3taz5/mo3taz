import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useLibrary } from "@renderer/hooks";
import "./immersive-background.scss";

interface ImmersiveBackgroundProps {
  heroImageUrl?: string;
}

export const ImmersiveBackground = ({
  heroImageUrl,
}: ImmersiveBackgroundProps) => {
  const location = useLocation();
  const { library } = useLibrary();
  const [currentImage, setCurrentImage] = useState<string | null>(
    heroImageUrl || null
  );
  const [isLoading, setIsLoading] = useState(false);

  // Resolve hero image from library if not provided directly
  const resolvedHeroImage = useMemo(() => {
    if (heroImageUrl) return heroImageUrl;

    // Try to extract game ID from route
    const gameMatch = location.pathname.match(/\/game\/([^/]+)\/([^/?]+)/);
    if (gameMatch) {
      const [, shop, objectId] = gameMatch;
      const game = library.find(
        (g) => g.shop === shop && g.objectId === objectId
      );
      return game?.customHeroImageUrl || game?.libraryHeroImageUrl || null;
    }

    return null;
  }, [heroImageUrl, location.pathname, library]);

  // Preload image before transitioning
  useEffect(() => {
    if (!resolvedHeroImage) {
      setCurrentImage(null);
      return;
    }

    setIsLoading(true);
    const img = new Image();
    img.src = resolvedHeroImage;
    img.onload = () => {
      setCurrentImage(resolvedHeroImage);
      setIsLoading(false);
    };
    img.onerror = () => {
      setIsLoading(false);
    };
  }, [resolvedHeroImage]);

  return (
    <div className="immersive-background" aria-hidden="true">
      {/* Base gradient layer */}
      <div className="immersive-background__gradient" />

      {/* Hero image layer with blur */}
      {currentImage && (
        <div
          className="immersive-background__image"
          style={{
            backgroundImage: `url(${currentImage})`,
            opacity: isLoading ? 0 : 1,
          }}
        />
      )}

      {/* Noise texture overlay */}
      <div className="immersive-background__noise" />

      {/* Vignette overlay */}
      <div className="immersive-background__vignette" />
    </div>
  );
};
