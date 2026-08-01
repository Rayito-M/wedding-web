export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  apiTimeout: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  /** GA4 measurement ID (e.g. `G-XXXXXXX`); blank skips loading GA entirely (ADR-0027). */
  gaMeasurementId: string;

  appName: string;
  appVersion: string;

  enabledRoutes: string[];
}
