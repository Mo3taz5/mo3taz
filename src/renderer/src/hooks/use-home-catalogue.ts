import { useCallback, useEffect, useMemo, useState } from "react";
import { orderBy } from "lodash-es";

import { CatalogueCategory } from "@shared";
import type { DownloadSource, ShopAssets } from "@types";
import { levelDBService } from "@renderer/services/leveldb.service";

const EMPTY_CATALOGUE: Record<CatalogueCategory, ShopAssets[]> = {
  [CatalogueCategory.Hot]: [],
  [CatalogueCategory.Weekly]: [],
  [CatalogueCategory.Achievements]: [],
};

const CATEGORIES = [
  CatalogueCategory.Hot,
  CatalogueCategory.Weekly,
  CatalogueCategory.Achievements,
] as const;

export function useHomeCatalogue() {
  const [currentCatalogueCategory, setCurrentCatalogueCategory] = useState(
    CatalogueCategory.Hot
  );
  const [catalogue, setCatalogue] = useState<Record<CatalogueCategory, ShopAssets[]>>(
    EMPTY_CATALOGUE
  );
  const [isLoading, setIsLoading] = useState(true);

  const refreshCatalogue = useCallback(async () => {
    setIsLoading(true);

    try {
      const sources = (await levelDBService.values(
        "downloadSources"
      )) as DownloadSource[];
      const downloadSources = orderBy(sources, "createdAt", "desc");

      const params = {
        take: 12,
        skip: 0,
        downloadSourceIds: downloadSources.map((source) => source.id),
      };

      const [hot, weekly, achievements] = await Promise.all([
        window.electron.hydraApi.get<ShopAssets[]>("/catalogue/hot", { params }),
        window.electron.hydraApi.get<ShopAssets[]>("/catalogue/weekly", {
          params,
        }),
        window.electron.hydraApi.get<ShopAssets[]>("/catalogue/achievements", {
          params,
        }),
      ]);

      setCatalogue({
        [CatalogueCategory.Hot]: hot,
        [CatalogueCategory.Weekly]: weekly,
        [CatalogueCategory.Achievements]: achievements,
      });
    } catch (error) {
      console.error("Failed to fetch home catalogue:", error);
      setCatalogue(EMPTY_CATALOGUE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalogue();
  }, [refreshCatalogue]);

  const allGames = useMemo(() => {
    const seen = new Set<string>();
    return CATEGORIES.flatMap((category) =>
      catalogue[category].filter((game) => {
        const key = `${game.shop}:${game.objectId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    );
  }, [catalogue]);

  return {
    catalogue,
    allGames,
    currentCatalogueCategory,
    setCurrentCatalogueCategory,
    isLoading,
    refreshCatalogue,
  };
}
