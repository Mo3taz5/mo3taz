import {
  GlobeIcon,
  TelescopeIcon,
  RepoIcon,
  DownloadIcon,
  GearIcon,
} from "@primer/octicons-react";

export const routes = [
  {
    path: "/",
    nameKey: "home",
    render: () => <GlobeIcon />,
  },
  {
    path: "/catalogue",
    nameKey: "catalogue",
    render: () => <TelescopeIcon />,
  },
  {
    path: "/library",
    nameKey: "library",
    render: () => <RepoIcon />,
  },
  {
    path: "/downloads",
    nameKey: "downloads",
    render: () => <DownloadIcon />,
  },
  {
    path: "/settings",
    nameKey: "settings",
    render: () => <GearIcon />,
  },
];
