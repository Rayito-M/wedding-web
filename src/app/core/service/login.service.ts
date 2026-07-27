import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { WeddingAuthenticationService, AuthTokenDto, SocialLoginDto } from '../api';
import { ConfigurationService } from './configuration.service';
import { TokenStorageService } from './token-storage.service';

const OAUTH_STATE_KEY = 'sc-oauth-state';

// Google OpenID Connect implicit flow: redirect the browser to the auth page,
// which returns an ID token in the callback URL fragment (no client secret).
const GOOGLE_SCOPES = 'openid email profile';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// Landing pages by role after successful authentication
const LANDING_BY_ROLE: Record<UserRole, string> = {
  guest: '/me',
  admin: '/dashboard',
};

/** ADR-0013: admins are guests carrying `role: admin`; everyone else is a guest. */
export type UserRole = 'guest' | 'admin';

/**
 * Login facade (ADR-0013 app-managed auth): wraps the generated auth client
 * for the phone + SMS OTP flow and social sign-in. RxJS stays inside this
 * service (Hard Rule #5) — imperative actions return `Promise` via
 * `firstValueFrom`; consumers only see signals and promises.
 */
@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly authApi = inject(WeddingAuthenticationService);
  private readonly config = inject(ConfigurationService);
  private readonly tokenStorage = inject(TokenStorageService);

  /** In-flight state for the OTP steps and the social token exchange. */
  readonly pending = signal(false);
  /** Last error message key, or `undefined` when the last action succeeded. */
  readonly error = signal<string | undefined>(undefined);
  /** The app-issued bearer token once verified, else `undefined`. */
  readonly token = this.tokenStorage.token;

  readonly isAuthenticated = computed(() => this.token() !== undefined);

  /**
   * Role of the signed-in user, read from the JWT's `role` claim (ADR-0013).
   * Defaults to `guest` when the claim is absent — forward-compatible with the
   * backend adding the claim later.
   */
  readonly role = signal<UserRole>(this.decodeRole(this.token()));

  protected readonly socialProviders = computed(
    () => this.config.weddingConfigPublic()?.socialProviders,
  );

  /** Where to send the user after authentication, based on their role. */
  landingUrl(): string {
    return LANDING_BY_ROLE[this.role()];
  }

  /**
   * Step 1: ask the backend to text a one-time code to `phoneNumber`.
   * Resolves `true` when the request was accepted (the response is identical
   * whether or not the number belongs to a guest, by design).
   */
  async requestOtp(phoneNumber: string): Promise<boolean> {
    this.pending.set(true);
    this.error.set(undefined);
    try {
      const res = await firstValueFrom(
        this.authApi.authControllerRequestOtpV1({ otpRequestDto: { phoneNumber } }),
      );
      return res.ok;
    } catch {
      this.error.set('login.errors.otpRequestFailed');
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Step 2: verify the SMS `code` for `phoneNumber`. On success stores the
   * app JWT and flips `isAuthenticated`. Resolves `true` when verified.
   */
  async verifyOtp(phoneNumber: string, code: string): Promise<boolean> {
    this.pending.set(true);
    this.error.set(undefined);
    try {
      const res = await firstValueFrom(
        this.authApi.authControllerVerifyOtpV1({ otpVerifyDto: { phoneNumber, code } }),
      );
      this.persistToken(res);
      return true;
    } catch {
      this.error.set('login.errors.otpVerifyFailed');
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Step 1 (magic link): request a magic-link email for `email`.
   * Resolves `true` when the request was accepted (the response is identical
   * whether or not the email belongs to a guest, by design).
   */
  async requestMagicLink(email: string): Promise<boolean> {
    this.pending.set(true);
    this.error.set(undefined);
    try {
      const callbackUrl = `${window.location.origin}/login/magic-link/verify`;
      const res = await firstValueFrom(
        this.authApi.authControllerRequestMagicLinkV1({
          magicLinkRequestDto: { email, callback: callbackUrl },
        }),
      );
      return res.ok;
    } catch {
      this.error.set('login.errors.magicLinkRequestFailed');
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Step 2 (magic link): verify the magic-link `token`. On success stores the
   * app JWT and flips `isAuthenticated`. Resolves `true` when verified.
   */
  async verifyMagicLink(token: string): Promise<boolean> {
    this.pending.set(true);
    this.error.set(undefined);
    try {
      const res = await firstValueFrom(
        this.authApi.authControllerVerifyMagicLinkV1({ magicLinkVerifyDto: { token } }),
      );
      this.persistToken(res);
      return true;
    } catch {
      this.error.set('login.errors.magicLinkVerifyFailed');
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Start social sign-in by redirecting the browser to the provider's
   * authorization page (OpenID Connect implicit flow). The provider returns to
   * `/login/callback/:provider` with an ID token in the URL fragment, which the
   * callback screen hands to {@link completeSocialLogin}. Only Google is wired.
   */
  startSocialLogin(provider: SocialLoginDto.ProviderEnum): void {
    this.error.set(undefined);
    const providerConfig = this.socialProviders()?.[provider];
    if (providerConfig === undefined) {
      this.error.set('login.errors.socialUnavailable');
      return;
    }

    const state = this.randomToken();
    const nonce = this.randomToken();
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
    } catch {
      // storage unavailable — state can't be checked on return; backend still verifies the token
    }

    const params = new URLSearchParams({
      client_id: providerConfig,
      redirect_uri: `${window.location.origin}/login/callback/google`,
      response_type: 'id_token',
      scope: GOOGLE_SCOPES,
      nonce,
      state,
      prompt: 'select_account',
    });
    window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
  }

  /** Validate (single-use) the CSRF `state` the provider echoes back. */
  verifyOAuthState(state: string | null): boolean {
    try {
      const stored = sessionStorage.getItem(OAUTH_STATE_KEY);
      sessionStorage.removeItem(OAUTH_STATE_KEY);
      return !!state && stored === state;
    } catch {
      return false;
    }
  }

  /**
   * Exchange a provider ID token for the app JWT via `POST /v1/auth/social`.
   * On success stores the token and flips `isAuthenticated`.
   */
  async completeSocialLogin(
    provider: SocialLoginDto.ProviderEnum,
    idToken: string,
  ): Promise<boolean> {
    this.pending.set(true);
    this.error.set(undefined);
    try {
      const res = await firstValueFrom(
        this.authApi.authControllerSocialLoginV1({
          socialLoginDto: { provider, idToken },
        }),
      );
      this.persistToken(res);
      return true;
    } catch {
      this.error.set('login.errors.socialFailed');
      return false;
    } finally {
      this.pending.set(false);
    }
  }

  logout(): void {
    this.tokenStorage.clear();
    this.role.set('guest');
  }

  private persistToken(auth: AuthTokenDto): void {
    this.tokenStorage.set(auth.accessToken);
    this.role.set(this.decodeRole(auth.accessToken));
  }

  /**
   * Read the `role` claim from a JWT payload. Returns `guest` for any missing
   * token, malformed token, or unrecognised role — never throws.
   */
  private decodeRole(token: string | undefined): UserRole {
    if (!token) return 'guest';
    try {
      const payload = token.split('.')[1];
      if (!payload) return 'guest';
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(base64)) as { role?: string };
      return json.role === 'admin' ? 'admin' : 'guest';
    } catch {
      return 'guest';
    }
  }

  private randomToken(): string {
    return crypto.randomUUID();
  }
}
