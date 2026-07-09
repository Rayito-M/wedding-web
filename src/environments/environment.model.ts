import { ThemeId } from '../app/model';

export type Language = 'en' | 'fr' | 'es';

export interface Location {
  name: string;
  city: string;
  country: string;
  postalCode: string;
  address: string;
  mapUrl: string;
}

export interface WeddingConfiguration {
  brideName: string;
  groomName: string;
  tagline: string;
  location: Location;
  date: string; // Optional property to hold the formatted date
}

export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  apiTimeout: number;
  enableLogging: boolean;
  enableAnalytics: boolean;

  language: Language[];
  themeId: ThemeId;

  weddingConfiguration: WeddingConfiguration;

  appName: string;
  appVersion: string;
}
