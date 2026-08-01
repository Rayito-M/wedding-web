import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://api.comolatruchaaltrucho.eu',
  apiTimeout: 30000,
  enableLogging: false,
  enableAnalytics: true,
  // TODO: set the real GA4 measurement ID before this ships to production (ADR-0027).
  gaMeasurementId: '',
  appName: 'Wedding App',
  appVersion: '1.0.0',
  enabledRoutes: ['rsvp', 'dashboard', 'config', 'me', 'schedule', 'people', 'guests'],
};
