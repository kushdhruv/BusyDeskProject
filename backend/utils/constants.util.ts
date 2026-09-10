/**
 * Application Constants
 * Defines SLA targets, thresholds, pagination bounds, session cookie configuration, and database transaction limits.
 */

export const SLA_TARGETS_MINUTES = {
  URGENT: 120, // 2 hours
  HIGH: 480, // 8 hours
  MEDIUM: 1440, // 24 hours (1 day)
  LOW: 4320, // 72 hours (3 days)
} as const;

export const SLA_WARNING_THRESHOLD_MINUTES = 60; // Flag as "DUE_SOON" within 60 minutes of breach

export const REOPEN_WINDOW_DAYS = 7;
export const REOPEN_WINDOW_MS = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const DEFAULT_PAGE_SIZE = 15;
export const MAX_PAGE_SIZE = 100;

export const SESSION_COOKIE_NAME = "busy_ticketing_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Default interactive transaction options for Prisma to prevent timeout during high-concurrency network spikes.
 */
export const DEFAULT_TX_OPTIONS = {
  maxWait: 10000, // Wait up to 10s to acquire a connection from the pool
  timeout: 20000, // Allow transaction up to 20s before rollback
};
