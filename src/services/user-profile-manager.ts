/**
 * ServalSheets - User Profile Manager
 *
 * Provides persistent user profile storage with learned patterns and preferences.
 * Enables cross-session learning and personalized experiences.
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * User profile structure with preferences, learnings, and history
 */
export interface UserProfile {
  userId: string;
  preferences: {
    chartStyle?: 'minimalist' | 'detailed' | 'colorful';
    confirmationLevel: 'always' | 'destructive' | 'never';
    formatPreferences?: {
      headers?: string;
      currency?: string;
      dateFormat?: string;
    };
  };
  learnings: {
    commonWorkflows: string[]; // e.g., "load_data → validate → fix → visualize"
    rejectedSuggestions: string[]; // Don't suggest these again
    qualityStandards?: {
      minDataQuality: number;
      maxNullPercent: number;
    };
  };
  history: {
    successfulFormulas: Array<{
      formula: string;
      useCase: string;
      successCount: number;
      // Extended fields for Phase 4 Formula Library
      category?: 'lookup' | 'aggregation' | 'text' | 'date' | 'array' | 'financial';
      performance?: 'fast' | 'medium' | 'slow';
      complexity?: 'simple' | 'intermediate' | 'complex';
      tags?: string[];
      lastUsed?: number;
    }>;
    errorPatterns: Array<{ error: string; count: number; lastSeen: string }>;
  };
  lastUpdated: number;
}

/**
 * Manages user profiles with file-based persistence
 */
export class UserProfileManager {
  private profiles = new Map<string, UserProfile>();
  private storageDir: string;

  constructor(storageDir = process.env['PROFILE_STORAGE_DIR'] || '/tmp/servalsheets-profiles') {
    this.storageDir = storageDir;
  }

  /**
   * Load user profile from memory or disk, creating new if needed
   */
  async loadProfile(userId: string): Promise<UserProfile> {
    // Try memory first
    if (this.profiles.has(userId)) {
      return this.profiles.get(userId)!;
    }

    // Try disk
    const filePath = path.join(this.storageDir, `${userId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const profile = JSON.parse(data) as UserProfile;
      this.profiles.set(userId, profile);
      logger.info('Loaded user profile from disk', { userId });
      return profile;
    } catch (_error) {
      // Create new profile if not found
      logger.info('Creating new user profile', { userId });
      return this.createProfile(userId);
    }
  }

  /**
   * Create a new user profile with default settings
   */
  private createProfile(userId: string): UserProfile {
    const profile: UserProfile = {
      userId,
      preferences: {
        confirmationLevel: 'destructive',
      },
      learnings: {
        commonWorkflows: [],
        rejectedSuggestions: [],
      },
      history: {
        successfulFormulas: [],
        errorPatterns: [],
      },
      lastUpdated: Date.now(),
    };

    this.profiles.set(userId, profile);
    return profile;
  }

  /**
   * Save user profile to memory and disk
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    profile.lastUpdated = Date.now();
    this.profiles.set(profile.userId, profile);

    try {
      // Write to disk
      const filePath = path.join(this.storageDir, `${profile.userId}.json`);
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
      logger.info('Saved user profile to disk', { userId: profile.userId });
    } catch (error) {
      logger.error('Failed to save user profile', { userId: profile.userId, error });
    }
  }

  /**
   * Learn from user corrections (e.g., user changed action X to Y)
   */
  async learnFromCorrection(
    userId: string,
    context: {
      originalAction: string;
      correctedAction: string;
      successful: boolean;
    }
  ): Promise<void> {
    const profile = await this.loadProfile(userId);

    // Track patterns: user prefers Y over X
    if (context.successful) {
      // Could track workflow patterns here
      logger.debug('Learning from successful correction', {
        userId,
        original: context.originalAction,
        corrected: context.correctedAction,
      });
    }

    await this.saveProfile(profile);
  }

  /**
   * Record a successful formula pattern
   */
  async recordSuccessfulFormula(userId: string, formula: string, useCase: string): Promise<void> {
    const profile = await this.loadProfile(userId);
    const existing = profile.history.successfulFormulas.find((f) => f.formula === formula);

    if (existing) {
      existing.successCount++;
    } else {
      profile.history.successfulFormulas.push({ formula, useCase, successCount: 1 });

      // Keep only top 50 formulas
      if (profile.history.successfulFormulas.length > 50) {
        profile.history.successfulFormulas.sort((a, b) => b.successCount - a.successCount);
        profile.history.successfulFormulas = profile.history.successfulFormulas.slice(0, 50);
      }
    }

    await this.saveProfile(profile);
  }

  /**
   * Record that user rejected a suggestion
   */
  async rejectSuggestion(userId: string, suggestion: string): Promise<void> {
    const profile = await this.loadProfile(userId);

    if (!profile.learnings.rejectedSuggestions.includes(suggestion)) {
      profile.learnings.rejectedSuggestions.push(suggestion);

      // Keep only last 100 rejections
      if (profile.learnings.rejectedSuggestions.length > 100) {
        profile.learnings.rejectedSuggestions = profile.learnings.rejectedSuggestions.slice(-100);
      }
    }

    await this.saveProfile(profile);
  }

  /**
   * Record error pattern for learning
   */
  async recordErrorPattern(userId: string, error: string): Promise<void> {
    const profile = await this.loadProfile(userId);
    const existing = profile.history.errorPatterns.find((e) => e.error === error);

    if (existing) {
      existing.count++;
      existing.lastSeen = new Date().toISOString();
    } else {
      profile.history.errorPatterns.push({
        error,
        count: 1,
        lastSeen: new Date().toISOString(),
      });

      // Keep only top 50 error patterns
      if (profile.history.errorPatterns.length > 50) {
        profile.history.errorPatterns.sort((a, b) => b.count - a.count);
        profile.history.errorPatterns = profile.history.errorPatterns.slice(0, 50);
      }
    }

    await this.saveProfile(profile);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
  ): Promise<void> {
    const profile = await this.loadProfile(userId);
    profile.preferences = { ...profile.preferences, ...preferences };
    await this.saveProfile(profile);
  }

  /**
   * Get top successful formulas for a user
   */
  async getTopFormulas(
    userId: string,
    limit = 10
  ): Promise<UserProfile['history']['successfulFormulas']> {
    const profile = await this.loadProfile(userId);
    return profile.history.successfulFormulas
      .sort((a, b) => b.successCount - a.successCount)
      .slice(0, limit);
  }

  /**
   * Check if a suggestion should be avoided (user rejected it before)
   */
  async shouldAvoidSuggestion(userId: string, suggestion: string): Promise<boolean> {
    const profile = await this.loadProfile(userId);
    return profile.learnings.rejectedSuggestions.includes(suggestion);
  }
}
