import {
  RECIPE_TRANSLATIONS,
  getRecipeAllergenLabel,
  getRecipeLocaleTag,
  translateRecipePlural,
  translateRecipeText,
} from "../recipeTranslations";

describe("recipe translations", () => {
  it("keeps the German, English and Spanish catalogs in sync", () => {
    const germanKeys = Object.keys(RECIPE_TRANSLATIONS.de).sort();

    expect(Object.keys(RECIPE_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(RECIPE_TRANSLATIONS.es).sort()).toEqual(germanKeys);
  });

  it("interpolates counts and selects singular copy", () => {
    expect(translateRecipePlural("en", "recipe.ingredients", 1)).toBe(
      "1 ingredient",
    );
    expect(translateRecipePlural("es", "catalog.hidden", 3)).toBe(
      "Hemos ocultado 3 recetas.",
    );
    expect(
      translateRecipeText("de", "shopping.addedSkipped", {
        added: 4,
        skipped: 2,
      }),
    ).toBe("4 Zutaten hinzugefügt, 2 standen bereits auf der Liste.");
  });

  it("provides localized allergen names and locale tags", () => {
    expect(getRecipeAllergenLabel("en", "milk")).toBe("Dairy");
    expect(getRecipeAllergenLabel("es", "nuts")).toBe("Frutos secos");
    expect(getRecipeAllergenLabel("de", "sesame")).toBe("sesame");
    expect(getRecipeLocaleTag("de")).toBe("de-DE");
    expect(getRecipeLocaleTag("en")).toBe("en-US");
    expect(getRecipeLocaleTag("es")).toBe("es-ES");
  });
});
