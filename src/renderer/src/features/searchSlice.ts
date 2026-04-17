/**
 * ============================================================
 * searchSlice.ts — Instant-Filter Redux Engine
 * ============================================================
 *
 * Maintains the master game list and applies a pure, memoized
 * filter pipeline. Zero side effects, zero async, zero DOM access.
 *
 * Pipeline:
 *   1. Collection filter (if active)
 *   2. Favorites filter (if active)
 *   3. Text match (case-insensitive substring on title)
 *   4. Sort by last played (descending)
 */

import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { LibraryGame } from "@types";

// ---- Strict Type Definitions ----

export interface SearchState {
  /** Full master list — loaded once, never mutated */
  allGames: LibraryGame[];
  /** Current raw query (immediate input feedback) */
  query: string;
  /** Debounced query — the filter pipeline reads from this */
  debouncedQuery: string;
  /** Active collection filter ID, or null */
  collectionFilter: string | null;
  /** Whether to show only favorited games */
  favoritesOnly: boolean;
}

const initialState: SearchState = {
  allGames: [],
  query: "",
  debouncedQuery: "",
  collectionFilter: null,
  favoritesOnly: false,
};

export const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    /** Load the master game list (called once on Big Screen mount) */
    setAllGames: (state, action: PayloadAction<LibraryGame[]>) => {
      state.allGames = action.payload;
    },

    /** Update the raw query (immediate, for input field value) */
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },

    /** Commit the debounced query to trigger the filter pipeline */
    setDebouncedQuery: (state, action: PayloadAction<string>) => {
      state.debouncedQuery = action.payload;
    },

    /** Filter by collection ID */
    setCollectionFilter: (state, action: PayloadAction<string | null>) => {
      state.collectionFilter = action.payload;
    },

    /** Toggle favorites-only filter */
    toggleFavoritesOnly: (state) => {
      state.favoritesOnly = !state.favoritesOnly;
    },

    /** Reset all search/filter state to defaults */
    resetSearch: (state) => {
      state.query = "";
      state.debouncedQuery = "";
      state.collectionFilter = null;
      state.favoritesOnly = false;
    },
  },
});

export const {
  setAllGames,
  setQuery,
  setDebouncedQuery,
  setCollectionFilter,
  toggleFavoritesOnly,
  resetSearch,
} = searchSlice.actions;

// ---- Pure Filter Pipeline ----

/**
 * FILTER AND SORT GAMES:
 *
 * This is a PURE function. Same inputs always produce the same output.
 * No DOM access, no side effects, no I/O, no network.
 *
 * Stages:
 *   1. Collection filter — keep only games in the selected collection
 *   2. Favorites filter — keep only games marked as favorite
 *   3. Text search — case-insensitive substring match on title
 *   4. Sort — most recently played games first (stable sort)
 */
function filterAndSortGames(
  games: LibraryGame[],
  query: string,
  collectionFilter: string | null,
  favoritesOnly: boolean
): LibraryGame[] {
  const queryLower = query.toLowerCase().trim();
  let result = games;

  // Stage 1: Collection filter
  if (collectionFilter) {
    result = result.filter((game) =>
      game.collectionIds?.includes(collectionFilter)
    );
  }

  // Stage 2: Favorites filter
  if (favoritesOnly) {
    result = result.filter((game) => game.favorite === true);
  }

  // Stage 3: Text search (case-insensitive substring)
  if (queryLower) {
    result = result.filter((game) =>
      game.title.toLowerCase().includes(queryLower)
    );
  }

  // Stage 4: Stable sort by last played (most recent first)
  result = [...result].sort((a, b) => {
    const aTime = a.lastTimePlayed ? new Date(a.lastTimePlayed).getTime() : 0;
    const bTime = b.lastTimePlayed ? new Date(b.lastTimePlayed).getTime() : 0;
    return bTime - aTime;
  });

  return result;
}

// ---- Memoized Selectors ----

/**
 * Primary selector: returns the filtered + sorted game list.
 *
 * Uses `createSelector` (Reselect) to memoize the result.
 * The selector only re-computes when one of its inputs changes
 * by reference. This prevents unnecessary re-renders.
 */
export const selectFilteredGames = createSelector(
  [
    (state: { search: SearchState }) => state.search.allGames,
    (state: { search: SearchState }) => state.search.debouncedQuery,
    (state: { search: SearchState }) => state.search.collectionFilter,
    (state: { search: SearchState }) => state.search.favoritesOnly,
  ],
  filterAndSortGames
);

/** Returns the current raw query (for input field binding) */
export const selectSearchQuery = (state: { search: SearchState }) =>
  state.search.query;

/** Returns whether any filter is currently active */
export const selectIsFilterActive = createSelector(
  [
    (state: { search: SearchState }) => state.search.query,
    selectFilteredGames,
    (state: { search: SearchState }) => state.search.allGames,
  ],
  (query, filtered, all) => query.length > 0 || filtered.length !== all.length
);

export default searchSlice.reducer;
