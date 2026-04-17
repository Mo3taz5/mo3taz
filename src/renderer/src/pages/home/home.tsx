import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import Skeleton, { SkeletonTheme } from "react-loading-skeleton";

import { Button, GameCard, Hero } from "@renderer/components";

import flameIconStatic from "@renderer/assets/icons/flame-static.png";
import flameIconAnimated from "@renderer/assets/icons/flame-animated.gif";

import { buildGameDetailsPath } from "@renderer/helpers";
import { CatalogueCategory } from "@shared";
import { useHomeCatalogue } from "@renderer/hooks";
import "./home.scss";

export default function Home() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();

  const [animateFlame, setAnimateFlame] = useState(false);
  const {
    catalogue,
    allGames,
    currentCatalogueCategory,
    setCurrentCatalogueCategory,
    isLoading,
  } = useHomeCatalogue();

  const handleCategoryClick = (category: CatalogueCategory) => {
    if (category !== currentCatalogueCategory) {
      setCurrentCatalogueCategory(category);
    }
  };

  const categories = Object.values(CatalogueCategory);

  const handleMouseEnterCategory = (category: CatalogueCategory) => {
    if (category === CatalogueCategory.Hot) {
      setAnimateFlame(true);
    }
  };

  const handleMouseLeaveCategory = (category: CatalogueCategory) => {
    if (category === CatalogueCategory.Hot) {
      setAnimateFlame(false);
    }
  };

  return (
    <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
      <section className="home__content">
        <Hero games={allGames} isLoading={isLoading} />

        <section className="home__header">
          <ul className="home__buttons-list">
            {categories.map((category) => (
              <li key={category}>
                <Button
                  theme={
                    category === currentCatalogueCategory
                      ? "primary"
                      : "outline"
                  }
                  onClick={() => handleCategoryClick(category)}
                  onMouseEnter={() => handleMouseEnterCategory(category)}
                  onMouseLeave={() => handleMouseLeaveCategory(category)}
                >
                  {category === CatalogueCategory.Hot && (
                    <div className="home__icon-wrapper">
                      <img
                        src={flameIconStatic}
                        alt=""
                        className="home__flame-icon"
                        style={{ display: animateFlame ? "none" : "block" }}
                      />
                      <img
                        src={flameIconAnimated}
                        alt=""
                        className="home__flame-icon"
                        style={{ display: animateFlame ? "block" : "none" }}
                      />
                    </div>
                  )}

                  {t(category)}
                </Button>
              </li>
            ))}
          </ul>

        </section>

        <h2 className="home__title">
          {currentCatalogueCategory === CatalogueCategory.Hot && (
            <div className="home__title-icon">
              <img
                src={flameIconAnimated}
                alt=""
                className="home__title-flame-icon"
              />
            </div>
          )}

          {t(currentCatalogueCategory)}
        </h2>

        <section className="home__cards">
          {isLoading
            ? Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="home__card-skeleton" />
              ))
            : catalogue[currentCatalogueCategory].map((result) => (
              <GameCard
                key={result.objectId}
                game={result}
                onClick={() => navigate(buildGameDetailsPath(result))}
                className="home__game-card"
              />
            ))}
        </section>
      </section>
    </SkeletonTheme>
  );
}
