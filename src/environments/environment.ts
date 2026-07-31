import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  apiTimeout: 30000,
  enableLogging: true,
  enableAnalytics: false,
  appName: 'Wedding App',
  appVersion: '1.0.0',
  enabledRoutes: ['rsvp', 'dashboard', 'config', 'me', 'schedule', 'people', 'guest'],
};
