import { getLanguageFromCountry } from "../helpers/ip-language-detector";

export interface IPLocationResponse {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

/**
 * Fetches the user's public IP address.
 * Uses multiple fallback services for reliability.
 */
async function getUserIP(): Promise<string> {
  const services = [
    "https://api.ipify.org?format=json",
    "https://ipinfo.io/json",
    "https://ip-api.com/json/",
  ];

  for (const service of services) {
    try {
      const response = await fetch(service, { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      
      if (data.ip) {
        return data.ip;
      }
    } catch (error) {
      console.warn(`Failed to fetch IP from ${service}:`, error);
    }
  }

  throw new Error("Failed to fetch user IP from all services");
}

/**
 * Fetches location information from an IP address.
 * Uses multiple fallback services for reliability.
 */
async function getLocationFromIP(ip: string): Promise<IPLocationResponse> {
  const services = [
    {
      url: `https://ipinfo.io/${ip}/json`,
      parse: (data: any) => ({
        country: data.country,
        countryCode: data.country,
        region: data.region,
        city: data.city,
        lat: data.loc?.split(",")[0],
        lon: data.loc?.split(",")[1],
      }),
    },
    {
      url: `http://ip-api.com/json/${ip}`,
      parse: (data: any) => ({
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.city,
        lat: data.lat,
        lon: data.lon,
      }),
    },
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url, { signal: AbortSignal.timeout(5000) });
      const data = await response.json();
      return service.parse(data);
    } catch (error) {
      console.warn(`Failed to fetch location from ${service.url}:`, error);
    }
  }

  return {};
}

/**
 * Detects the user's language based on their IP address.
 * Falls back to English if the country's language is not supported.
 * 
 * @returns Detected language code (e.g., "en", "pt-BR", "de")
 */
export async function detectLanguageFromIP(): Promise<string> {
  try {
    const ip = await getUserIP();
    const location = await getLocationFromIP(ip);
    
    if (location.countryCode) {
      const language = getLanguageFromCountry(location.countryCode);
      console.log(
        `[Language] IP detection: ip=${ip}, country=${location.countryCode}, language=${language}`
      );
      return language;
    }
  } catch (error) {
    console.warn("Failed to detect language from IP:", error);
  }

  // Fallback to English
  return "en";
}
