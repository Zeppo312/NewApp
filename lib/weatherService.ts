import { API_KEYS, API_ENDPOINTS } from './config';

export interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  location: string;
}

/**
 * Hilfsunktion für detaillierte Fehlerprotokollierung
 */
function logApiError(method: string, error: any, url?: string) {
  console.error(`[WeatherService] ${method} error:`, error);
  
  if (url) {
    console.log(`[WeatherService] URL: ${url}`);
  }
  
  // Bei Netzwerkfehlern mehr Details anzeigen
  if (error.message === 'Network request failed') {
    console.error('[WeatherService] Network error - check internet connection');
  }
  
  // Bei API-Fehlern den kompletten Response anzeigen, falls vorhanden
  if (error.response) {
    console.error('[WeatherService] API error response:', error.response);
  }
}

/**
 * Ruft Wetterdaten basierend auf geografischen Koordinaten ab
 */
export async function getWeatherByCoordinates(lat: number, lon: number): Promise<WeatherData> {
  const url = `${API_ENDPOINTS.WEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&lang=de&appid=${API_KEYS.WEATHER_API_KEY}`;
  
  try {
    console.log(`[WeatherService] Fetching weather for coordinates: ${lat}, ${lon}`);
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[WeatherService] API responded with status ${response.status}:`, errorBody);
      throw new Error(`Weather API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return transformWeatherData(data);
  } catch (error) {
    logApiError('getWeatherByCoordinates', error, url);
    throw error;
  }
}

/**
 * Ruft Wetterdaten basierend auf Postleitzahl ab
 */
export async function getWeatherByZipCode(zipCode: string, countryCode: string = 'de'): Promise<WeatherData> {
  const url = `${API_ENDPOINTS.WEATHER_BASE_URL}/weather?zip=${zipCode},${countryCode}&units=metric&lang=de&appid=${API_KEYS.WEATHER_API_KEY}`;
  
  try {
    console.log(`[WeatherService] Fetching weather for zip code: ${zipCode}`);
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[WeatherService] API responded with status ${response.status}:`, errorBody);
      throw new Error(`Weather API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return transformWeatherData(data);
  } catch (error) {
    logApiError('getWeatherByZipCode', error, url);
    throw error;
  }
}

/**
 * Ruft Wetterdaten basierend auf Stadtnamen ab
 */
export async function getWeatherByCity(cityName: string, countryCode: string = 'de'): Promise<WeatherData> {
  // Codiere den Stadtnamen für URL-Sicherheit
  const encodedCityName = encodeURIComponent(cityName);
  const url = `${API_ENDPOINTS.WEATHER_BASE_URL}/weather?q=${encodedCityName},${countryCode}&units=metric&lang=de&appid=${API_KEYS.WEATHER_API_KEY}`;
  
  try {
    console.log(`[WeatherService] Fetching weather for city: ${cityName}`);
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[WeatherService] API responded with status ${response.status}:`, errorBody);
      throw new Error(`Weather API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return transformWeatherData(data);
  } catch (error) {
    logApiError('getWeatherByCity', error, url);
    throw error;
  }
}

/**
 * Transformiert die Rohdaten der API in unser WeatherData-Format
 */
function transformWeatherData(data: any): WeatherData {
  // Wandle das OpenWeatherMap-Icon in SF Symbols um
  const iconMapping: {[key: string]: string} = {
    '01d': 'sun.max.fill',        // klarer Himmel (Tag)
    '01n': 'moon.stars.fill',     // klarer Himmel (Nacht)
    '02d': 'cloud.sun.fill',      // leicht bewölkt (Tag)
    '02n': 'cloud.moon.fill',     // leicht bewölkt (Nacht)
    '03d': 'cloud.fill',          // bewölkt
    '03n': 'cloud.fill',
    '04d': 'smoke.fill',          // stark bewölkt
    '04n': 'smoke.fill',
    '09d': 'cloud.drizzle.fill',  // Nieselregen
    '09n': 'cloud.drizzle.fill',
    '10d': 'cloud.rain.fill',     // Regen (Tag)
    '10n': 'cloud.rain.fill',     // Regen (Nacht)
    '11d': 'cloud.bolt.rain.fill', // Gewitter
    '11n': 'cloud.bolt.rain.fill',
    '13d': 'cloud.snow.fill',     // Schnee
    '13n': 'cloud.snow.fill',
    '50d': 'cloud.fog.fill',      // Nebel
    '50n': 'cloud.fog.fill',
  };

  // Standardwert, falls die Zuordnung fehlschlägt
  let iconName = 'cloud.fill';
  
  // Versuche, das Icon zuzuordnen
  if (data.weather && data.weather.length > 0) {
    const apiIcon = data.weather[0].icon;
    iconName = iconMapping[apiIcon] || iconName;
  }

  return {
    temperature: Math.round(data.main.temp),
    description: data.weather[0]?.description || 'Keine Beschreibung verfügbar',
    icon: iconName,
    humidity: data.main.humidity,
    windSpeed: Math.round(data.wind.speed * 3.6), // Umrechnung von m/s in km/h
    feelsLike: Math.round(data.main.feels_like),
    location: data.name
  };
}

/**
 * Gibt Mock-Wetterdaten zurück (als Fallback bei API-Problemen)
 */
export function getMockWeatherData(isDefaultLocation: boolean = true, locationIdentifier?: string, isCityName: boolean = false): WeatherData {
  if (isDefaultLocation) {
    return {
      temperature: 15,
      description: 'Leicht bewölkt',
      icon: 'cloud.sun.fill',
      humidity: 65,
      windSpeed: 10,
      feelsLike: 14,
      location: 'Aktueller Standort'
    };
  } else {
    return {
      temperature: 14,
      description: 'Bewölkt',
      icon: 'cloud.fill',
      humidity: 70,
      windSpeed: 8,
      feelsLike: 12,
      location: locationIdentifier ? (isCityName ? locationIdentifier : `PLZ ${locationIdentifier}`) : 'Unbekannt'
    };
  }
} 