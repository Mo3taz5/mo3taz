import { useCallback, useEffect, useState } from "react";
import { levelDBService } from "@renderer/services/leveldb.service";
import type { DownloadSource } from "@types";
import { useAppDispatch } from "./redux";
import { setGenres, setTags } from "@renderer/features";
import steamGenresData from "@renderer/data/steam-genres.json";
import steamUserTagsData from "@renderer/data/steam-user-tags.json";

export function useCatalogue() {
  const dispatch = useAppDispatch();

  const [steamPublishers, setSteamPublishers] = useState<string[]>([]);
  const [steamDevelopers, setSteamDevelopers] = useState<string[]>([]);
  const [downloadSources, setDownloadSources] = useState<DownloadSource[]>([]);

  const getSteamUserTags = useCallback(() => {
    dispatch(setTags(steamUserTagsData as unknown as Record<string, Record<string, number>>));
  }, [dispatch]);

  const getSteamGenres = useCallback(() => {
    dispatch(setGenres(steamGenresData as unknown as Record<string, string[]>));
  }, [dispatch]);

  const getSteamPublishers = useCallback(() => {
    levelDBService.values("steamPublishers").then((results) => {
      const data = results as string[] | null;
      setSteamPublishers(Array.isArray(data) ? data : []);
    }).catch(() => {
      setSteamPublishers([]);
    });
  }, []);

  const getSteamDevelopers = useCallback(() => {
    levelDBService.values("steamDevelopers").then((results) => {
      const data = results as string[] | null;
      setSteamDevelopers(Array.isArray(data) ? data : []);
    }).catch(() => {
      setSteamDevelopers([]);
    });
  }, []);

  const getDownloadSources = useCallback(() => {
    levelDBService.values("downloadSources").then((results) => {
      const sources = results as DownloadSource[];
      setDownloadSources(sources.filter((source) => !!source.fingerprint));
    });
  }, []);

  useEffect(() => {
    getSteamUserTags();
    getSteamGenres();
    getSteamPublishers();
    getSteamDevelopers();
    getDownloadSources();
  }, [
    getSteamUserTags,
    getSteamGenres,
    getSteamPublishers,
    getSteamDevelopers,
    getDownloadSources,
  ]);

  return { steamPublishers, downloadSources, steamDevelopers };
}
