import { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://api.wedding-app.com/api',
  apiTimeout: 30000,
  enableLogging: false,
  enableAnalytics: true,
  appName: 'Wedding App',
  appVersion: '1.0.0',
};
