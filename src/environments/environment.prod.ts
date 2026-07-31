import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://api.comolatruchaaltrucho.eu',
  apiTimeout: 30000,
  enableLogging: false,
  enableAnalytics: true,
  appName: 'Wedding App',
  appVersion: '1.0.0',
  enabledRoutes: ['rsvp', 'dashboard', 'config', 'me', 'schedule', 'people', 'guests'],
};
