/**
 * Maps ISO 3166-1 alpha-2 country codes to their primary language codes.
 * Only includes languages that are supported by the project.
 * Supported languages: en, pt-BR, pt-PT, de, es, nl, fr, hu, it, pl, ru, tr, be, uk, zh, id, ko, da, ar, fa, fi, ro, ca, bg, kk, cs, nb, et, uz, sv, lv
 */

export const countryToLanguageMap: Record<string, string> = {
  // Portuguese (Brazil)
  BR: "pt-BR",

  // Portuguese (Portugal)
  PT: "pt-PT",

  // German
  DE: "de",
  AT: "de",
  LI: "de",

  // Spanish
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  PE: "es",
  VE: "es",
  CL: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  BO: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",

  // Dutch
  NL: "nl",
  SR: "nl",

  // French
  FR: "fr",
  LU: "fr",
  MC: "fr",
  SN: "fr",
  CI: "fr",
  ML: "fr",
  NE: "fr",
  BF: "fr",
  GN: "fr",
  TD: "fr",
  HT: "fr",
  BJ: "fr",

  // Hungarian
  HU: "hu",

  // Italian
  IT: "it",
  SM: "it",
  VA: "it",

  // Polish
  PL: "pl",

  // Russian
  RU: "ru",

  // Turkish
  TR: "tr",

  // Belarusian
  BY: "be",

  // Ukrainian
  UA: "uk",

  // Chinese
  CN: "zh",
  TW: "zh",
  HK: "zh",

  // Indonesian
  ID: "id",

  // Korean
  KR: "ko",
  KP: "ko",

  // Danish
  DK: "da",
  GL: "da",
  FO: "da",

  // Arabic
  SA: "ar",
  AE: "ar",
  EG: "ar",
  QA: "ar",
  BH: "ar",
  KW: "ar",
  OM: "ar",
  JO: "ar",
  IQ: "ar",
  YE: "ar",
  LB: "ar",
  LY: "ar",
  MA: "ar",
  TN: "ar",
  DZ: "ar",
  SD: "ar",
  SY: "ar",
  SO: "ar",
  DJ: "ar",
  KM: "ar",

  // Persian/Farsi
  IR: "fa",
  AF: "fa",
  TJ: "fa",

  // Finnish
  FI: "fi",

  // Romanian
  RO: "ro",
  MD: "ro",

  // Catalan
  AD: "ca",

  // Bulgarian
  BG: "bg",

  // Kazakh
  KZ: "kk",

  // Czech
  CZ: "cs",
  SK: "cs",

  // Norwegian Bokmål
  NO: "nb",

  // Estonian
  EE: "et",

  // Uzbek
  UZ: "uz",

  // Swedish
  SE: "sv",
  AX: "sv",

  // Latvian
  LV: "lv",
};

/**
 * Multi-language countries: Assign primary language, fallback to secondary if needed.
 * This function handles countries with multiple official languages.
 */
const multiLanguageCountries: Record<string, string[]> = {
  // Belgium - Dutch/French
  BE: ["nl", "fr"],
  // Switzerland - German/French/Italian
  CH: ["de", "fr", "it"],
  // Canada - French/English
  CA: ["fr", "en"],
  // Belarus - Belarusian/Russian
  // Already handled by separate entries
  // Kazakhstan - Kazakh/Russian
  // Already handled by separate entries
  // Cyprus - Turkish/English
  CY: ["tr", "en"],
  // Singapore - English/Chinese/Malay
  SG: ["en", "zh"],
  // Malaysia - English/Chinese/Malay
  MY: ["en", "zh"],
};

/**
 * Get the language code for a given country code.
 * Falls back to English if the country is not supported.
 * 
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Language code (e.g., "en", "pt-BR", "de")
 */
export function getLanguageFromCountry(countryCode: string): string {
  const upperCode = countryCode.toUpperCase();
  
  // Check single-language countries first
  if (countryToLanguageMap[upperCode]) {
    return countryToLanguageMap[upperCode];
  }
  
  // Handle multi-language countries
  if (multiLanguageCountries[upperCode]) {
    // Return the first (primary) language for this country
    return multiLanguageCountries[upperCode][0];
  }

  // Fallback to English for unsupported countries
  return "en";
}
