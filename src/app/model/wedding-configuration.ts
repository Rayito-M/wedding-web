import { BaseDocument } from './document';
import { LangCode } from './i18n';
import { GeoLocation } from './location';
import { ThemeId } from './theme';

export interface WeddingLocation {
  church: GeoLocation;
  reception: GeoLocation;
}

export interface WeddingConfiguration extends BaseDocument {
  brideName: string;
  groomName: string;
  tagline: string;
  location: WeddingLocation;
  city: string; // Optional property to hold the city name
  country: string; // Optional property to hold the country name
  date: string; // Optional property to hold the formatted date
  language: LangCode[];
  themeId: ThemeId;
}
