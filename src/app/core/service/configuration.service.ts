import { Injectable, Signal, signal } from '@angular/core';

import { Environment, environment } from '../../../environments';
import { WeddingConfiguration } from '../../model';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private readonly config: Environment = environment;
  private readonly _weddingConfiguration = signal<WeddingConfiguration | undefined>(undefined);

  private constructor() {
    this.fetchWeddingConfiguration();
  }

  private fetchWeddingConfiguration() {
    // Simulate an async backend call; replace the setTimeout with a real
    // httpResource()/HttpClient request once the endpoint exists.
    setTimeout(() => {
      this._weddingConfiguration.set({
        id: 'wedding-configuration',
        version: 0,
        createdAt: '2026-07-10T09:39:53Z',
        updatedAt: '2026-07-10T09:39:53Z',
        namespace: 'wedding-configuration',
        brideName: 'Sara',
        groomName: 'Christophe',
        tagline: 'como la trucha al trucho',
        date: '2027-06-05T10:00:00Z',
        language: ['es', 'fr', 'en'],
        themeId: 'terracotta',
        location: {
          church: {
            name: 'Iglesia Parroquial de Nuestro Salvador',
            city: 'Granada',
            country: 'Spain',
            postalCode: '18010',
            address: 'Pl. del Salvador, Albaicín',
            mapUrl: 'https://maps.app.goo.gl/SAZnqWGWWMrkRakQ7',
          },
          reception: {
            name: 'Palacio de los Córdova',
            city: 'Granada',
            country: 'Spain',
            postalCode: '18010',
            address: 'cta. del chapiz, 2-4, albaicín',
            mapUrl: 'https://maps.app.goo.gl/vCX7vDpyNmVaRjfEA',
          },
        },
      });
    }, 300);
  }

  get weddingConfiguration(): Signal<WeddingConfiguration | undefined> {
    return this._weddingConfiguration.asReadonly();
  }

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
}
