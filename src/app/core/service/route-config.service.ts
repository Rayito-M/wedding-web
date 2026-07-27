import { Injectable } from '@angular/core';
import { signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RouteConfigService {
  private readonly enabledRoutes = signal<string[]>([]);

  // Set enabled routes array (from environment or API)
  setRouteConfig(routes: string[]) {
    this.enabledRoutes.set(routes);
  }

  // Check if a route is enabled
  isRouteEnabled(path: string): boolean {
    const normalizedPath = path.replace(/^\//, ''); // Remove leading slash
    return this.enabledRoutes().includes(normalizedPath);
  }

  // Get current config (read-only)
  getConfig = computed(() => this.enabledRoutes());
}
