import { Environment } from './environment.model';

export const environment: Environment = {
  stage: 'local',
  apiBaseUrl: 'http://localhost:3000',
  apiTimeout: 30000,
  enableLogging: true,
  enableAnalytics: false,
  gaMeasurementId: 'G-818GKW72TD',
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
    'travel',
    'profile',
  ],
};
