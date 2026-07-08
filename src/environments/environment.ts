import { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api',
  apiTimeout: 30000,
  enableLogging: true,
  enableAnalytics: false,
  language: ['en', 'es', 'fr'],
  appName: 'Wedding App',
  appVersion: '1.0.0',
  weddingConfiguration: {
    brideName: 'Sara',
    groomName: 'Christophe',
    tagline: 'como la trucha al trucho',
    date: '2027-06-05T10:00:00Z',
    location: {
      name: 'palacio de los córdova',
      city: 'grenade',
      country: 'spain',
      postalCode: '18010',
      address: 'cta. del chapiz, 2-4, albaicín',
      mapUrl: 'https://maps.app.goo.gl/vCX7vDpyNmVaRjfEA',
    },
  },
};
