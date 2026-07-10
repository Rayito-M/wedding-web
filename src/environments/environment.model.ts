export interface Environment {
  production: boolean;
  apiBaseUrl: string;
  apiTimeout: number;
  enableLogging: boolean;
  enableAnalytics: boolean;

  appName: string;
  appVersion: string;
}
