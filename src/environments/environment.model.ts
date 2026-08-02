export type AppStage = 'local' | 'dev' | 'alpha' | 'beta' | 'production';
export interface Environment {
  stage: AppStage;
  apiBaseUrl: string;
  apiTimeout: number;
  enableLogging: boolean;
  enableAnalytics: boolean;
  /** GA4 measurement ID (e.g. `G-XXXXXXX`); blank skips loading GA entirely (ADR-0027). */
  gaMeasurementId: string;
  /** Sentry DSN; blank no-ops `Sentry.init` entirely (hub ADR-0026). */
  sentryDsn: string;

  appName: string;
  appVersion: string;

  enabledRoutes: string[];
}
