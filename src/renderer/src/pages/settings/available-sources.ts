export interface AvailableSource {
  id: string;
  name: string;
  description: string;
  url: string;
  fingerprint?: string;
  status?: 'Trusted' | 'Untrusted' | 'Unknown';
  gamesCount?: string;
  downloadsCount?: string;
  copiesCount?: string;
  activeUsers?: string;
  addedDate?: string;
  rating?: string;
  ratingCount?: string;
  icon?: string;
}

export const availableSources: AvailableSource[] = [
  {
    id: 'fitgirl',
    name: 'FitGirl',
    description: "Home archivist to web's top game repacker: the ultimate source for trustworthy games.",
    url: 'https://hydralinks.cloud/sources/fitgirl.json',
    fingerprint: 'fitgirl',
    status: 'Trusted',
    gamesCount: '8.0K',
    downloadsCount: '614.0K',
    copiesCount: '1.1M',
    activeUsers: '6.0K',
    addedDate: '12/29/2024',
    rating: '4.1',
    ratingCount: '81',
  },
  {
    id: 'steamrip',
    name: 'SteamRip [DIRECT DOWNLOAD / NO TORRENT]',
    description: 'Pre-installed games, uncompressed, and sourced reliably.',
    url: 'https://hydralinks.cloud/sources/steamrip.json',
    fingerprint: 'steamrip',
    status: 'Trusted',
    gamesCount: '2.5K',
    downloadsCount: '554.7K',
    copiesCount: '926.5K',
    activeUsers: '5.0K',
    addedDate: '12/29/2024',
    rating: '4.1',
    ratingCount: '47',
  },
  {
    id: 'onlinefix',
    name: 'Online-Fix',
    description: 'Grants online solutions to play multiplayer in specific games with others.',
    url: 'https://hydralinks.cloud/sources/onlinefix.json',
    fingerprint: 'onlinefix',
    status: 'Trusted',
    gamesCount: '2.2K',
    downloadsCount: '513.7K',
    copiesCount: '880.8K',
    activeUsers: '4.2K',
    addedDate: '12/29/2024',
    rating: '4.2',
    ratingCount: '38',
  },
  {
    id: 'dodi',
    name: 'DODI',
    description: 'Renowned brand in pirated video games, this repacker is among the finest in the field',
    url: 'https://hydralinks.cloud/sources/dodi.json',
    fingerprint: 'dodi',
    status: 'Trusted',
    gamesCount: '3.1K',
    downloadsCount: '455.6K',
    copiesCount: '822.2K',
    activeUsers: '3.9K',
    addedDate: '12/29/2024',
    rating: '4.2',
    ratingCount: '38',
  },
  {
    id: 'xatab',
    name: 'Xatab',
    description: 'Popular Russian repacker known for highly compressed game installations.',
    url: 'https://hydralinks.cloud/sources/xatab.json',
    fingerprint: 'xatab',
    status: 'Trusted',
  },
  {
    id: 'gog',
    name: 'GOG',
    description: 'DRM-free games from the GOG platform.',
    url: 'https://hydralinks.cloud/sources/gog.json',
    fingerprint: 'gog',
    status: 'Trusted',
  },
  {
    id: 'atop-games',
    name: 'Atop Games',
    description: 'Game source offering a variety of repacks and direct downloads.',
    url: 'https://hydralinks.cloud/sources/atop-games.json',
    fingerprint: 'atop-games',
    status: 'Trusted',
  },
  {
    id: 'davidkazumi',
    name: 'David Kazumi Source',
    description: 'Community game source with curated selections.',
    url: 'https://davidkazumisource.com/fontekazumi.json',
    status: 'Unknown',
  },
  {
    id: 'steamgg',
    name: 'SteamGG',
    description: 'Game source offering pre-installed and repacked games.',
    url: 'https://wkeynhk.online/steamgg.json',
    status: 'Unknown',
  },
  {
    id: 'rexagames',
    name: 'RexaGames',
    description: 'Game repacks and direct download source.',
    url: 'https://hydralinks.cloud/sources/rexagames.json',
    fingerprint: 'rexagames',
    status: 'Trusted',
  },
  {
    id: 'empress',
    name: 'Empress',
    description: 'Well-known cracker and repacker for DRM-free game releases.',
    url: 'https://hydralinks.cloud/sources/empress.json',
    fingerprint: 'empress',
    status: 'Trusted',
  },
  {
    id: 'rutracker',
    name: 'RuTracker',
    description: 'Large torrent tracker with extensive game library.',
    url: 'https://raw.githubusercontent.com/KekitU/rutracker-hydra-links/main/all_categories.json',
    status: 'Unknown',
  },
  {
    id: 'kaoskrew',
    name: 'KaosKrew',
    description: 'Game repack group offering compressed installations.',
    url: 'https://hydralinks.cloud/sources/kaoskrew.json',
    fingerprint: 'kaoskrew',
    status: 'Trusted',
  },
  {
    id: 'tinyrepacks',
    name: 'Tiny Repacks',
    description: 'Small and efficient game repacks.',
    url: 'https://hydralinks.cloud/sources/tinyrepacks.json',
    fingerprint: 'tinyrepacks',
    status: 'Trusted',
  },
  {
    id: 'rutor',
    name: 'Rutor',
    description: 'Russian torrent tracker with game section.',
    url: 'https://wkeynhk.online/rutor.json',
    status: 'Unknown',
  },
];
