import { Environment } from './environment.model';

export const environment: Environment = {
  stage: 'production',
  apiBaseUrl: 'https://api.comolatruchaaltrucho.eu',
  apiTimeout: 30000,
  enableLogging: false,
  enableAnalytics: true,
  // TODO: set the real GA4 measurement ID before this ships to production (ADR-0027).
  gaMeasurementId: 'G-D165J9XHN6',
  // TODO: set the real Sentry DSN before this ships to production (hub ADR-0026).
  sentryDsn:
    'https://2d5f8ac3e8872a5eaf0fdaec3adf79a7@o4511840254361600.ingest.de.sentry.io/4511840255737936',
  appName: 'Wedding App',
  appVersion: '1.0.0',
  enabledRoutes: [
    'rsvp',
    'dashboard',
    'config',
    'me',
    'schedule',
    'guests',
    'milestones',
    'people',
  ],
};
