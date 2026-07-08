import { Injectable } from '@angular/core';

import { Environment, Language, environment } from '../../../environments';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  readonly config: Environment = environment;

  isProduction(): boolean {
    return this.config.production;
  }

  isDevelopment(): boolean {
    return !this.config.production;
  }

  getApiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  getApiTimeout(): number {
    return this.config.apiTimeout;
  }

  isLoggingEnabled(): boolean {
    return this.config.enableLogging;
  }

  isAnalyticsEnabled(): boolean {
    return this.config.enableAnalytics;
  }

  getAppName(): string {
    return this.config.appName;
  }

  getAppVersion(): string {
    return this.config.appVersion;
  }

  getLanguages(): Language[] {
    return this.config.language;
  }

  get weddingConfiguration() {
    return this.config.weddingConfiguration;
  }
}
