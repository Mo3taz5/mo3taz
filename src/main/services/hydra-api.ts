import axios from "axios";

import { HydraApiError } from "@shared";
import { appVersion } from "@main/constants";
import { logger } from "./logger";
import { db, levelKeys } from "@main/level";
import type { AxiosError, AxiosInstance } from "axios";

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  profile: { id: string | number; username: string; hasActiveSubscription?: boolean };
};

type HydraApiConfig = {
  needsAuth?: boolean;
  params?: Record<string, any>;
  headers?: Record<string, string>;
};

export class HydraApi {
  private static readonly ADD_LOG_INTERCEPTOR = false;

  private static instance: AxiosInstance;
  private static accessToken = "";
  private static refreshTokenValue = "";
  private static profileId: string | null = null;
  private static profileUsername = "";
  private static refreshSubscribers: ((token: string) => void)[] = [];
  private static hasActiveSubscriptionValue = false;

  static getProfile() {
    return {
      id: this.profileId,
      username: this.profileUsername,
    };
  }

  static isLoggedIn() {
    return !!this.accessToken;
  }

  static hasActiveSubscription() {
    return this.hasActiveSubscriptionValue;
  }

  static async setupApi() {
    this.instance = axios.create({
      baseURL: import.meta.env.MAIN_VITE_API_URL,
      headers: { "User-Agent": `MO3TAZ Launcher v${appVersion}` },
      maxRedirects: 0, // Don't follow redirects automatically - we'll handle them ourselves
      validateStatus: (status) => status >= 200 && status < 400, // Accept 2xx and 3xx as success
    });

    if (this.ADD_LOG_INTERCEPTOR) {
      this.instance.interceptors.request.use(
        (request) => {
          logger.log(" ---- REQUEST ----");
          logger.log(request.method, request.url, request.data);
          return request;
        },
        (error) => {
          logger.error("request error", error);
          return Promise.reject(error);
        }
      );

      this.instance.interceptors.response.use(
        (response) => {
          logger.log(" ---- RESPONSE ----");
          logger.log(response.status, response.data);
          return response;
        },
        (error) => {
          logger.error("response error", error);
          return Promise.reject(error);
        }
      );
    }

    this.instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          this.refreshTokenValue
        ) {
          originalRequest._retry = true;

          try {
            const response = await this.instance.post<AuthResponse>(
              "/auth/refresh",
              { refreshToken: this.refreshTokenValue },
              // @ts-ignore - custom config property
              { needsAuth: false }
            );

            const data = response.data as AuthResponse;

            this.accessToken = data.accessToken;
            this.refreshTokenValue = data.refreshToken;

            this.refreshSubscribers.forEach((cb) => cb(data.accessToken));
            this.refreshSubscribers = [];

            return this.instance(originalRequest);
          } catch (refreshError) {
            this.refreshSubscribers = [];
            this.accessToken = "";
            this.refreshTokenValue = "";
            this.hasActiveSubscriptionValue = false;
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    // Load auth tokens from DB on startup
    await this.loadAuthFromDb();
  }

  static async login(email: string, password: string) {
    try {
      // Track login attempt
      const { AnalyticsService, AnalyticsEvent } = await import("./analytics.service");
      const analytics = AnalyticsService.getInstance();
      await analytics.track(AnalyticsEvent.LoginAttempt, { emailHash: this.hashEmail(email) });

      const response = await this.instance.post<any>(
        "/auth/login",
        { email, password },
        {
          needsAuth: false,
          maxRedirects: 0, // Don't follow redirects
          validateStatus: (status: number) => status >= 200 && status < 300 // Only 2xx is success
        } as any
      );

      logger.info("Login response status:", response.status);
      logger.info("Login response data type:", typeof response.data);
      logger.info("Login response data:", JSON.stringify(response.data).substring(0, 500));

      const data = response.data as AuthResponse;

      // Validate response structure
      if (!data.accessToken || !data.refreshToken || !data.profile) {
        logger.error("Invalid login response from API:", JSON.stringify(data).substring(0, 500));
        await analytics.track(AnalyticsEvent.LoginFailed, { reason: "invalid_response" });
        throw new Error("Invalid response from authentication server. Check API configuration.");
      }

      this.accessToken = data.accessToken;
      this.refreshTokenValue = data.refreshToken;
      this.profileId = String(data.profile.id); // Convert to string to handle both number and string IDs
      this.profileUsername = data.profile.username;
      this.hasActiveSubscriptionValue = data.profile.hasActiveSubscription === true;

      // Persist auth to database
      await this.persistAuthToDb();

      // Track successful login
      await analytics.track(AnalyticsEvent.LoginSuccess, { 
        profileId: this.profileId,
        username: this.profileUsername 
      });

      return { accessToken: data.accessToken, refreshToken: data.refreshToken, profile: data.profile };
    } catch (error: any) {
      logger.error("Login error:", error.message);
      logger.error("Login error response:", error.response?.data);
      
      // Track failed login
      const { AnalyticsService, AnalyticsEvent } = await import("./analytics.service");
      const analytics = AnalyticsService.getInstance();
      await analytics.track(AnalyticsEvent.LoginFailed, { 
        error: error.message,
        statusCode: error.response?.status 
      });
      
      throw error;
    }
  }

  private static hashEmail(email: string): string {
    // Simple hash to anonymize email for analytics
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private static async persistAuthToDb() {
    try {
      // @ts-ignore - ClassicLevel supports object values with valueEncoding
      await db.put(levelKeys.auth, {
        accessToken: this.accessToken,
        refreshToken: this.refreshTokenValue,
        tokenExpirationTimestamp: Date.now() + 3600000, // 1 hour from now
        workwondersJwt: "", // Not used in this app
      });
    } catch (error) {
      logger.error("Failed to persist auth to DB:", error);
    }
  }

  private static async loadAuthFromDb() {
    try {
      // @ts-ignore - ClassicLevel supports valueEncoding option
      const auth = await db.get<string, any>(levelKeys.auth, {
        valueEncoding: "json",
      });

      if (auth && auth.accessToken && auth.refreshToken) {
        this.accessToken = auth.accessToken;
        this.refreshTokenValue = auth.refreshToken;
        logger.info("Auth tokens restored from DB");
      }
    } catch (error) {
      // No auth in DB, that's okay
      logger.info("No saved auth tokens found in DB");
    }
  }

  static async handleExternalAuth(url: string) {
    logger.log(`[HydraApi] handleExternalAuth called with URL: ${url.substring(0, 150)}...`);
    const { searchParams } = new URL(url);
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const profileId = searchParams.get("profileId");
    const profileUsername = searchParams.get("profileUsername");
    const hasActiveSubscription = searchParams.get("hasActiveSubscription");

    logger.log(`[HydraApi] Extracted params: accessToken=${!!accessToken}, refreshToken=${!!refreshToken}, profileId=${profileId}, profileUsername=${profileUsername}`);

    if (!accessToken || !refreshToken || !profileId || !profileUsername) {
      logger.error(`[HydraApi] Missing required auth params. accessToken=${!!accessToken}, refreshToken=${!!refreshToken}, profileId=${profileId}, profileUsername=${profileUsername}`);
      throw new HydraApiError("Invalid external auth URL");
    }

    this.accessToken = accessToken;
    this.refreshTokenValue = refreshToken;
    this.profileId = profileId; // Store as string - JWT userId is not a number
    this.profileUsername = profileUsername;
    this.hasActiveSubscriptionValue = hasActiveSubscription === "true";

    logger.log(`[HydraApi] Auth state updated in memory. profileId=${this.profileId}, username=${this.profileUsername}`);

    // Persist auth to database
    logger.log(`[HydraApi] Persisting auth to database...`);
    await this.persistAuthToDb();
    logger.log(`[HydraApi] Auth persisted successfully`);

    // Notify renderer that user signed in
    logger.log(`[HydraApi] Sending on-signin event to renderer`);
    const { WindowManager } = await import("./window-manager");
    WindowManager.mainWindow?.webContents.send("on-signin");
    logger.log(`[HydraApi] on-signin event sent`);
  }

  static async refreshToken() {
    if (!this.refreshTokenValue) {
      throw new HydraApiError("No refresh token available");
    }

    const response = await this.instance.post<AuthResponse>(
      "/auth/refresh",
      { refreshToken: this.refreshTokenValue },
      // @ts-ignore - custom config property
      { needsAuth: false }
    );

    const data = response.data as AuthResponse;

    this.accessToken = data.accessToken;
    this.refreshTokenValue = data.refreshToken;

    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  }

  static async handleSignOut() {
    this.accessToken = "";
    this.refreshTokenValue = "";
    this.profileId = null;
    this.profileUsername = "";
    this.hasActiveSubscriptionValue = false;
    this.refreshSubscribers = [];

    // Delete auth from database
    try {
      // @ts-ignore - delete method exists in ClassicLevel
      await db.delete(levelKeys.auth);
    } catch (error) {
      logger.error("Failed to delete auth from DB:", error);
    }
  }

  static async post<T>(
    url: string,
    data?: unknown,
    config?: HydraApiConfig
  ): Promise<T> {
    const response = await this.instance.post<T>(url, data, {
      headers: config?.needsAuth
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {},
    });

    return response.data;
  }

  static async get<T>(
    url: string,
    config?: HydraApiConfig
  ): Promise<T> {
    const response = await this.instance.get<T>(url, {
      params: config?.params,
      headers: {
        ...(config?.needsAuth ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...(config?.headers || {}),
      },
    });

    return response.data;
  }

  static async put<T>(
    url: string,
    data?: unknown,
    config?: HydraApiConfig
  ): Promise<T> {
    const response = await this.instance.put<T>(url, data, {
      headers: config?.needsAuth
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {},
    });

    return response.data;
  }

  static async delete<T>(
    url: string,
    config?: HydraApiConfig
  ): Promise<T> {
    const response = await this.instance.delete<T>(url, {
      headers: config?.needsAuth
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {},
    });

    return response.data;
  }

  static async patch<T>(
    url: string,
    data?: unknown,
    config?: HydraApiConfig
  ): Promise<T> {
    const response = await this.instance.patch<T>(url, data, {
      headers: config?.needsAuth
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {},
    });

    return response.data;
  }

  static async checkDownloadSourcesChanges(
    downloadSourceIds: string[],
    games: Array<{ shop: string; objectId: string }>,
    since: string
  ) {
    const response = await this.instance.post<{
      since: string;
      games: Array<{
        shop: string;
        objectId: string;
        newDownloadOptionsCount: number;
      }>;
    }>(
      "/download-sources/changes",
      { downloadSourceIds, games, since },
      // @ts-ignore - custom config property
      { needsAuth: false }
    );

    return response.data;
  }
}
