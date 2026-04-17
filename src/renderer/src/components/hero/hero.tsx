import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShopAssets, TrendingGame, ShopDetailsWithAssets } from "@types";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { buildGameDetailsPath } from "@renderer/helpers";
import "./hero.scss";

type HeroGame = ShopAssets | TrendingGame;

interface HeroProps {
  games?: HeroGame[];
  isLoading?: boolean;
}

const stripHtml = (value: string) => {
  if (!value) return "";

  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
};

const shuffleArray = <T,>(array: T[], seed: number): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const randomIndex =
      Math.floor((seed * (i + 1) * 9301 + 49297) % 233280) % (i + 1);
    [result[i], result[randomIndex]] = [result[randomIndex], result[i]];
  }
  return result;
};

export function Hero({ games, isLoading: externalLoading = false }: HeroProps) {
  const [featuredGameDetails, setFeaturedGameDetails] = useState<
    TrendingGame[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [randomSeed] = useState(() => Math.random());
  const [bannerDetails, setBannerDetails] =
    useState<ShopDetailsWithAssets | null>(null);

  const { i18n } = useTranslation();

  const navigate = useNavigate();

  const dynamicGames = useMemo(() => {
    const gameList = games ?? [];
    if (gameList.length <= 1) return gameList;
    return shuffleArray(gameList, randomSeed);
  }, [games, randomSeed]);
  const activeGame = dynamicGames[activeIndex];

  const resolveGameDescription = useCallback(
    (game: HeroGame) => {
      if ("description" in game && game.description) {
        return game.description;
      }

      const shortDescription =
        bannerDetails?.short_description?.trim() ||
        stripHtml(bannerDetails?.about_the_game ?? "");

      return shortDescription || game.title;
    },
    [bannerDetails]
  );

  useEffect(() => {
    if (games) {
      return;
    }

    setIsLoading(true);

    const language = i18n.language.split("-")[0];

    window.electron.hydraApi
      .get<TrendingGame[]>("/catalogue/featured", {
        params: { language },
        needsAuth: false,
      })
      .then((result) => {
        setFeaturedGameDetails(result.slice(0, 1));
      })
      .catch(() => {
        setFeaturedGameDetails([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [games, i18n.language]);

  useEffect(() => {
    if (!dynamicGames.length) {
      setBannerDetails(null);
      return;
    }

    setActiveIndex(0);
  }, [dynamicGames]);

  useEffect(() => {
    if (dynamicGames.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % dynamicGames.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [dynamicGames.length]);

  useEffect(() => {
    if (!activeGame) return;

    if ("description" in activeGame && activeGame.description) {
      setBannerDetails(null);
      return;
    }

    const language = i18n.language.split("-")[0];
    let cancelled = false;

    setBannerDetails(null);

    window.electron
      .getGameShopDetails(activeGame.objectId, activeGame.shop, language)
      .then((result) => {
        if (!cancelled) {
          setBannerDetails(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBannerDetails(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeGame, i18n.language]);

  if (externalLoading || isLoading) {
    return <Skeleton className="hero" />;
  }

  if (dynamicGames.length) {
    const game = activeGame;

    if (!game) {
      return null;
    }

    const logoImage =
      ("description" in game && game.logoImageUrl) ||
      bannerDetails?.assets?.logoImageUrl ||
      game.logoImageUrl ||
      game.iconUrl ||
      game.libraryImageUrl ||
      null;

    const heroImage =
      bannerDetails?.assets?.libraryHeroImageUrl ||
      game.libraryHeroImageUrl ||
      game.coverImageUrl ||
      game.libraryImageUrl ||
      game.iconUrl ||
      null;

    return (
      <button
        type="button"
        onClick={() => {
          if ("uri" in game) {
            navigate(game.uri);
            return;
          }

          navigate(buildGameDetailsPath(game));
        }}
        className="hero"
        key={`${game.shop}-${game.objectId}`}
      >
        <div className="hero__backdrop">
          <img
            src={heroImage ?? undefined}
            alt={resolveGameDescription(game)}
            className="hero__media"
          />

          <div className="hero__content">
            {logoImage && (
              <img
                src={logoImage ?? undefined}
                width="250px"
                alt={game.title}
                loading="eager"
                className="hero__logo"
              />
            )}
            <p className="hero__description">{resolveGameDescription(game)}</p>
          </div>
        </div>
      </button>
    );
  }

  if (featuredGameDetails?.length) {
    return featuredGameDetails.map((game) => (
      <button
        type="button"
        onClick={() => navigate(game.uri)}
        className="hero"
        key={game.uri}
      >
        <div className="hero__backdrop">
          <img
            src={game.libraryHeroImageUrl ?? undefined}
            alt={game.description ?? ""}
            className="hero__media"
          />

          <div className="hero__content">
            <img
              src={game.logoImageUrl ?? undefined}
              width="250px"
              alt={game.description ?? ""}
              loading="eager"
              className="hero__logo"
            />
            <p className="hero__description">{game.description}</p>
          </div>
        </div>
      </button>
    ));
  }

  return null;
}
