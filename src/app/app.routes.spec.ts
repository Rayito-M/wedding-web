import { routes } from './app.routes';

/**
 * T304 — the "My profile" screen becomes an account-dropdown modal
 * (`ProfileModalService`); the standalone `/profile` route is retired.
 */
describe('app.routes — /profile no longer resolves to a profile screen (T304)', () => {
  function flattenPaths(): string[] {
    const paths: string[] = [];
    const walk = (list: typeof routes): void => {
      for (const route of list) {
        if (route.path !== undefined) paths.push(route.path);
        if (route.children) walk(route.children);
      }
    };
    walk(routes);
    return paths;
  }

  it('has no "profile" path entry anywhere in the route tree', () => {
    expect(flattenPaths()).not.toContain('profile');
  });

  it('still falls back to the wildcard redirect for a stale bookmark/link', () => {
    const wildcard = routes.find((r) => r.path === '**');
    expect(wildcard?.redirectTo).toBe('');
  });
});
