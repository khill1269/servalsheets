---
title: 'ServalSheets: Code Protection, Monetization & Viral Growth Implementation'
category: business
last_updated: 2026-01-31
description: 'You have three viable paths:'
version: 1.6.0
tags: [sheets, prometheus]
---

# ServalSheets: Code Protection, Monetization & Viral Growth Implementation

## Part 1: Code Protection Strategy

### The Core Decision: Open Source vs. Proprietary

You have three viable paths:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CODE PROTECTION OPTIONS                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Option A: FULLY PROPRIETARY (Recommended for Max Protection)           │
│  ├── Server-side execution only (SaaS)                                  │
│  ├── No npm package with full code                                      │
│  ├── API proxy model                                                    │
│  └── Protection: ★★★★★                                                  │
│                                                                          │
│  Option B: OPEN CORE (Recommended for Growth + Protection)              │
│  ├── Basic tools open source (community/marketing)                      │
│  ├── Advanced features proprietary (charts, BigQuery, etc.)             │
│  ├── Dual licensing (MIT free, commercial paid)                         │
│  └── Protection: ★★★☆☆                                                  │
│                                                                          │
│  Option C: SOURCE-AVAILABLE (Middle Ground)                             │
│  ├── Code visible but not freely usable commercially                    │
│  ├── BSL or SSPL license                                                │
│  ├── Converts to open source after 2-3 years                            │
│  └── Protection: ★★★★☆                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### My Recommendation: Hybrid Approach

```
FREE/OPEN                              PROPRIETARY/HOSTED
─────────────────────────────────────────────────────────────

┌─────────────────┐                   ┌─────────────────────┐
│  COMMUNITY      │                   │  CLOUD SERVICE      │
│  (Open Source)  │                   │  (Proprietary)      │
├─────────────────┤                   ├─────────────────────┤
│ • sheets_data   │                   │ • All 21 tools      │
│ • sheets_core   │    ──────────►    │ • Usage metering    │
│ • Basic auth    │    Upgrade to     │ • Team management   │
│ • 5 tools       │                   │ • Analytics         │
│ • 50 actions    │                   │ • Priority support  │
│                 │                   │ • SLA guarantees    │
└─────────────────┘                   └─────────────────────┘
     ~20% of value                        100% of value
     Marketing engine                     Revenue engine
```

### Implementation: Code Obfuscation & Protection

If you want to distribute code but protect it:

```typescript
// 1. Build-time obfuscation (add to package.json)
{
  "scripts": {
    "build:protected": "tsc && javascript-obfuscator dist --output dist-protected --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding base64"
  },
  "devDependencies": {
    "javascript-obfuscator": "^4.1.0"
  }
}
```

```typescript
// 2. License key validation (add to server startup)
// src/licensing/validator.ts

import crypto from 'crypto';

interface LicensePayload {
  customerId: string;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  expiresAt: number;
  features: string[];
  maxOpsPerMonth: number;
}

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
YOUR_RSA_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----`;

export function validateLicense(licenseKey: string): LicensePayload | null {
  try {
    const [payload, signature] = licenseKey.split('.');
    const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');
    const decodedSignature = Buffer.from(signature, 'base64');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(decodedPayload);

    if (!verify.verify(PUBLIC_KEY, decodedSignature)) {
      return null; // Invalid signature
    }

    const license = JSON.parse(decodedPayload) as LicensePayload;

    if (license.expiresAt < Date.now()) {
      return null; // Expired
    }

    return license;
  } catch {
    return null;
  }
}

export function checkFeatureAccess(license: LicensePayload | null, feature: string): boolean {
  if (!license) {
    // Free tier features
    const freeFeatures = ['sheets_data.read', 'sheets_data.write', 'sheets_core.get'];
    return freeFeatures.includes(feature);
  }

  return license.features.includes(feature) || license.features.includes('*');
}
```

```typescript
// 3. Feature gating by tier
// src/middleware/featureGate.ts

const FEATURE_TIERS = {
  free: [
    'sheets_data.read',
    'sheets_data.write',
    'sheets_data.append',
    'sheets_core.get',
    'sheets_core.list_sheets',
  ],
  pro: [
    '*sheets_data*',
    '*sheets_core*',
    '*sheets_format*',
    '*sheets_dimensions*',
    'sheets_visualize.chart_create',
    'sheets_visualize.chart_list',
    'sheets_analyze.comprehensive',
  ],
  team: [
    '*', // All features
    '-sheets_bigquery*', // Except BigQuery
    '-sheets_appsscript*', // Except Apps Script
  ],
  enterprise: ['*'], // Everything
};

export function isFeatureAllowed(tier: string, action: string): boolean {
  const allowedPatterns = FEATURE_TIERS[tier] || FEATURE_TIERS.free;

  for (const pattern of allowedPatterns) {
    if (pattern.startsWith('-')) {
      // Exclusion pattern
      if (matchPattern(pattern.slice(1), action)) return false;
    } else if (matchPattern(pattern, action)) {
      return true;
    }
  }
  return false;
}

function matchPattern(pattern: string, action: string): boolean {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(action);
}
```

### Server-Side Only Architecture (Maximum Protection)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROTECTED ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User's Machine                      Your Cloud                         │
│   ┌─────────────┐                    ┌─────────────────────────────┐    │
│   │   Claude    │                    │     ServalSheets Cloud       │    │
│   │   Desktop   │                    │  ┌─────────────────────────┐│    │
│   │             │   MCP Protocol     │  │   API Gateway           ││    │
│   │  ┌───────┐  │◄──────────────────►│  │   (Rate Limiting)       ││    │
│   │  │ Thin  │  │   (JSON-RPC)       │  └───────────┬─────────────┘│    │
│   │  │Client │  │                    │              │              │    │
│   │  └───────┘  │                    │  ┌───────────▼─────────────┐│    │
│   └─────────────┘                    │  │   Auth & Metering       ││    │
│                                      │  │   (License Check)       ││    │
│   Thin client contains:              │  └───────────┬─────────────┘│    │
│   • MCP transport only               │              │              │    │
│   • No business logic                │  ┌───────────▼─────────────┐│    │
│   • License key storage              │  │   ServalSheets Core     ││    │
│                                      │  │   (All 267 Actions)     ││    │
│                                      │  │   PROTECTED             ││    │
│                                      │  └───────────┬─────────────┘│    │
│                                      │              │              │    │
│                                      │  ┌───────────▼─────────────┐│    │
│                                      │  │   Google Sheets API     ││    │
│                                      │  └─────────────────────────┘│    │
│                                      └─────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Token-Based Usage & Billing System

### Architecture Overview

```typescript
// src/billing/usageTracker.ts

interface UsageRecord {
  customerId: string;
  action: string;
  tokens: number;
  timestamp: Date;
  spreadsheetId: string;
  success: boolean;
  latencyMs: number;
}

interface UsageLimits {
  free: { monthlyTokens: 1000; dailyTokens: 100 };
  pro: { monthlyTokens: 50000; dailyTokens: 5000 };
  team: { monthlyTokens: 200000; dailyTokens: 20000 };
  enterprise: { monthlyTokens: Infinity; dailyTokens: Infinity };
}

// Token costs per action category
const TOKEN_COSTS = {
  // Read operations (cheap)
  'sheets_data.read': 1,
  'sheets_data.batch_read': 2,
  'sheets_core.get': 1,
  'sheets_core.list_sheets': 1,

  // Write operations (moderate)
  'sheets_data.write': 2,
  'sheets_data.batch_write': 3,
  'sheets_data.append': 2,
  'sheets_format.set_format': 3,

  // Complex operations (expensive)
  'sheets_visualize.chart_create': 10,
  'sheets_visualize.pivot_create': 10,
  'sheets_analyze.comprehensive': 15,
  'sheets_analyze.suggest_chart': 8,

  // Premium operations (very expensive)
  'sheets_bigquery.query': 25,
  'sheets_appsscript.run': 20,
  'sheets_composite.import_csv': 15,

  // Default
  default: 2,
};

export class UsageTracker {
  private redis: Redis;
  private stripe: Stripe;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async trackUsage(
    customerId: string,
    action: string
  ): Promise<{
    allowed: boolean;
    tokensUsed: number;
    tokensRemaining: number;
    resetAt: Date;
  }> {
    const tokens = TOKEN_COSTS[action] || TOKEN_COSTS.default;
    const monthKey = `usage:${customerId}:${this.getMonthKey()}`;
    const dayKey = `usage:${customerId}:${this.getDayKey()}`;

    // Get customer tier
    const customer = await this.getCustomer(customerId);
    const limits = UsageLimits[customer.tier];

    // Check limits
    const [monthlyUsed, dailyUsed] = await Promise.all([
      this.redis.get(monthKey),
      this.redis.get(dayKey),
    ]);

    const currentMonthly = parseInt(monthlyUsed || '0');
    const currentDaily = parseInt(dailyUsed || '0');

    if (currentMonthly + tokens > limits.monthlyTokens) {
      return {
        allowed: false,
        tokensUsed: 0,
        tokensRemaining: limits.monthlyTokens - currentMonthly,
        resetAt: this.getMonthReset(),
      };
    }

    if (currentDaily + tokens > limits.dailyTokens) {
      return {
        allowed: false,
        tokensUsed: 0,
        tokensRemaining: limits.dailyTokens - currentDaily,
        resetAt: this.getDayReset(),
      };
    }

    // Increment usage
    await Promise.all([
      this.redis.incrby(monthKey, tokens),
      this.redis.incrby(dayKey, tokens),
      this.redis.expire(monthKey, 35 * 24 * 60 * 60), // 35 days
      this.redis.expire(dayKey, 2 * 24 * 60 * 60), // 2 days
    ]);

    // Report to Stripe for usage-based billing (Pro+ tiers)
    if (customer.tier !== 'free') {
      await this.reportToStripe(customerId, tokens);
    }

    return {
      allowed: true,
      tokensUsed: tokens,
      tokensRemaining: limits.monthlyTokens - currentMonthly - tokens,
      resetAt: this.getMonthReset(),
    };
  }

  private async reportToStripe(customerId: string, tokens: number) {
    // Stripe usage-based billing
    await this.stripe.subscriptionItems.createUsageRecord(customerId, {
      quantity: tokens,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  }
}
```

### Stripe Integration for Usage-Based Billing

```typescript
// src/billing/stripeSetup.ts

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create products and prices (run once during setup)
export async function setupStripeProducts() {
  // Create the product
  const product = await stripe.products.create({
    name: 'ServalSheets',
    description: 'AI-powered Google Sheets automation',
  });

  // Free tier (no Stripe needed)

  // Pro tier - Base + Usage
  const proBase = await stripe.prices.create({
    product: product.id,
    unit_amount: 2900, // $29.00
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Pro Base',
  });

  const proUsage = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'metered',
      aggregate_usage: 'sum',
    },
    unit_amount_decimal: '0.1', // $0.001 per token overage
    nickname: 'Pro Usage Overage',
  });

  // Team tier
  const teamBase = await stripe.prices.create({
    product: product.id,
    unit_amount: 9900, // $99.00
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: 'Team Base',
  });

  // Enterprise - custom pricing via sales

  return { proBase, proUsage, teamBase };
}

// Create a subscription with usage tracking
export async function createSubscription(customerId: string, tier: 'pro' | 'team') {
  const prices = await getStoredPrices();

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      { price: prices[`${tier}Base`] },
      { price: prices[`${tier}Usage`] }, // Metered component
    ],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
}
```

### Database Schema for Usage & Customers

```sql
-- PostgreSQL schema for ServalSheets billing

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) UNIQUE,
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team', 'enterprise')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- License keys
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  key_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256 of the key
  tier VARCHAR(20) NOT NULL,
  features JSONB DEFAULT '[]',
  max_ops_per_month INTEGER DEFAULT 1000,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking (partitioned by month for performance)
CREATE TABLE usage_records (
  id BIGSERIAL,
  customer_id UUID REFERENCES customers(id),
  action VARCHAR(100) NOT NULL,
  tokens INTEGER NOT NULL,
  spreadsheet_id VARCHAR(100),
  success BOOLEAN DEFAULT true,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE usage_records_2026_01 PARTITION OF usage_records
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE usage_records_2026_02 PARTITION OF usage_records
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... continue for each month

-- Indexes for fast lookups
CREATE INDEX idx_usage_customer_month ON usage_records (customer_id, created_at);
CREATE INDEX idx_customers_stripe ON customers (stripe_customer_id);
CREATE INDEX idx_license_customer ON license_keys (customer_id);

-- Usage summary view
CREATE MATERIALIZED VIEW usage_summary AS
SELECT
  customer_id,
  DATE_TRUNC('month', created_at) as month,
  SUM(tokens) as total_tokens,
  COUNT(*) as total_operations,
  COUNT(*) FILTER (WHERE success) as successful_ops,
  AVG(latency_ms) as avg_latency
FROM usage_records
GROUP BY customer_id, DATE_TRUNC('month', created_at);

-- Refresh summary daily
CREATE OR REPLACE FUNCTION refresh_usage_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY usage_summary;
END;
$$ LANGUAGE plpgsql;
```

### Pricing Display Component

```typescript
// Pricing tiers for marketing/docs

export const PRICING_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    priceAnnual: 0,
    tokens: 1000,
    description: 'For trying out ServalSheets',
    features: [
      '1,000 tokens/month',
      '5 basic tools',
      'Read & write operations',
      'Community support',
    ],
    limitations: ['No charts or pivots', 'No BigQuery', 'No Apps Script', 'No priority support'],
    cta: 'Get Started Free',
  },

  pro: {
    name: 'Pro',
    price: 29,
    priceAnnual: 290, // 2 months free
    tokens: 50000,
    description: 'For power users and small teams',
    features: [
      '50,000 tokens/month',
      'All 21 tools',
      'Charts & pivots',
      'Conditional formatting',
      'Email support',
      '$0.001/token overage',
    ],
    limitations: ['No BigQuery', 'No Apps Script', 'No SLA'],
    cta: 'Start Pro Trial',
    popular: true,
  },

  team: {
    name: 'Team',
    price: 99,
    priceAnnual: 990,
    tokens: 200000,
    seats: 5,
    description: 'For growing teams',
    features: [
      '200,000 tokens/month',
      'All Pro features',
      '5 team seats',
      'BigQuery integration',
      'Apps Script execution',
      'Priority support',
      'Usage analytics dashboard',
    ],
    limitations: ['No custom SLA', 'No SSO'],
    cta: 'Start Team Trial',
  },

  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    priceAnnual: 'Custom',
    tokens: 'Unlimited',
    seats: 'Unlimited',
    description: 'For large organizations',
    features: [
      'Unlimited tokens',
      'Unlimited seats',
      'All features',
      'Custom SLA (99.9%+)',
      'SSO/SAML',
      'Dedicated support',
      'On-premise option',
      'Security review',
      'Custom integrations',
    ],
    limitations: [],
    cta: 'Contact Sales',
  },
};
```

---

## Part 3: Viral Marketing Implementation

### Viral Loop Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VIRAL GROWTH LOOPS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LOOP 1: Powered-By Attribution                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ User creates automation → Sheet footer shows "⚡ ServalSheets"     │ │
│  │ → Colleague sees it → Clicks link → Signs up → Creates automation │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LOOP 2: Template Sharing                                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ User creates useful template → Shares publicly → Others discover   │ │
│  │ → Need ServalSheets to use it → Sign up → Create own templates    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LOOP 3: Referral Program                                               │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ User refers friend → Friend signs up → Both get bonus tokens       │ │
│  │ → Friend refers their friends → Exponential growth                 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  LOOP 4: Social Proof                                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ User shares win on Twitter → Followers see → Try ServalSheets      │ │
│  │ → They share their wins → More followers see → Cycle continues     │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation: Powered-By Attribution

```typescript
// src/viral/attribution.ts

// Add attribution to spreadsheets (free tier only)
export async function addAttribution(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tier: string
) {
  // Only add for free tier
  if (tier !== 'free') return;

  // Add a small note in the spreadsheet properties
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSpreadsheetProperties: {
            properties: {
              // Add to developer metadata (invisible but trackable)
              developerMetadata: [
                {
                  metadataKey: 'servalsheets',
                  metadataValue: JSON.stringify({
                    version: '1.0.0',
                    tier: 'free',
                    created: new Date().toISOString(),
                  }),
                  visibility: 'DOCUMENT',
                },
              ],
            },
            fields: 'developerMetadata',
          },
        },
      ],
    },
  });
}

// For charts created on free tier, add watermark
export async function addChartWatermark(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  chartId: number,
  tier: string
) {
  if (tier !== 'free') return;

  // Add subtitle with attribution
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateChartSpec: {
            chartId,
            spec: {
              subtitle: 'Created with ServalSheets.com',
              subtitleTextFormat: {
                fontSize: 8,
                foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 },
              },
            },
            fields: 'subtitle,subtitleTextFormat',
          },
        },
      ],
    },
  });
}
```

### Implementation: Referral Program

```typescript
// src/viral/referral.ts

interface ReferralRewards {
  referrer: { tokens: number; maxReferrals: number };
  referee: { tokens: number; discount: number };
}

const REFERRAL_REWARDS: Record<string, ReferralRewards> = {
  free: {
    referrer: { tokens: 500, maxReferrals: 10 },
    referee: { tokens: 500, discount: 0 },
  },
  pro: {
    referrer: { tokens: 5000, maxReferrals: 50 },
    referee: { tokens: 2500, discount: 0.2 }, // 20% off first month
  },
  team: {
    referrer: { tokens: 20000, maxReferrals: 100 },
    referee: { tokens: 10000, discount: 0.25 },
  },
};

export class ReferralSystem {
  async generateReferralCode(customerId: string): Promise<string> {
    const customer = await this.getCustomer(customerId);

    // Generate unique code
    const code = `${customer.name.slice(0, 4).toUpperCase()}${randomString(6)}`;

    await db.referralCodes.create({
      code,
      customerId,
      tier: customer.tier,
      usageCount: 0,
      maxUsage: REFERRAL_REWARDS[customer.tier].referrer.maxReferrals,
    });

    return code;
  }

  async applyReferralCode(
    newCustomerId: string,
    referralCode: string
  ): Promise<{ success: boolean; bonusTokens: number }> {
    const code = await db.referralCodes.findOne({ code: referralCode });

    if (!code || code.usageCount >= code.maxUsage) {
      return { success: false, bonusTokens: 0 };
    }

    const rewards = REFERRAL_REWARDS[code.tier];

    // Credit referrer
    await this.creditTokens(code.customerId, rewards.referrer.tokens);

    // Credit referee
    await this.creditTokens(newCustomerId, rewards.referee.tokens);

    // Apply discount if applicable
    if (rewards.referee.discount > 0) {
      await this.applyDiscount(newCustomerId, rewards.referee.discount);
    }

    // Increment usage
    await db.referralCodes.update({ code: referralCode }, { $inc: { usageCount: 1 } });

    // Track for analytics
    await this.trackReferral(code.customerId, newCustomerId, referralCode);

    return { success: true, bonusTokens: rewards.referee.tokens };
  }

  async getReferralStats(customerId: string) {
    const code = await db.referralCodes.findOne({ customerId });
    const referrals = await db.referrals.find({ referrerId: customerId });

    return {
      code: code?.code,
      totalReferrals: referrals.length,
      tokensEarned: referrals.length * REFERRAL_REWARDS[code.tier].referrer.tokens,
      remainingSlots: code.maxUsage - code.usageCount,
    };
  }
}
```

### Implementation: Social Sharing Prompts

```typescript
// src/viral/socialSharing.ts

interface SharePrompt {
  trigger: string;
  message: string;
  platforms: string[];
}

const SHARE_PROMPTS: SharePrompt[] = [
  {
    trigger: 'first_chart_created',
    message:
      '🎉 Just created my first AI-powered chart with @ServalSheets! No code needed. #AIautomation',
    platforms: ['twitter', 'linkedin'],
  },
  {
    trigger: 'time_saved_1hour',
    message:
      '⏱️ ServalSheets just saved me an hour of spreadsheet work. AI + Google Sheets = 🔥 @ServalSheets',
    platforms: ['twitter'],
  },
  {
    trigger: '100_operations',
    message:
      '📊 100 automated operations completed with @ServalSheets! My spreadsheets basically run themselves now.',
    platforms: ['twitter', 'linkedin'],
  },
  {
    trigger: 'bigquery_first_use',
    message:
      '🚀 Just connected BigQuery to Google Sheets with one command. @ServalSheets makes enterprise data accessible.',
    platforms: ['twitter', 'linkedin'],
  },
];

export class SocialSharing {
  async checkTriggers(customerId: string, event: string, metadata: any) {
    const prompt = SHARE_PROMPTS.find((p) => p.trigger === event);

    if (!prompt) return null;

    // Check if user has already been prompted for this
    const alreadyPrompted = await db.sharePrompts.findOne({
      customerId,
      trigger: event,
    });

    if (alreadyPrompted) return null;

    // Mark as prompted
    await db.sharePrompts.create({
      customerId,
      trigger: event,
      promptedAt: new Date(),
    });

    // Return share data
    return {
      message: prompt.message,
      platforms: prompt.platforms,
      shareUrls: this.generateShareUrls(prompt.message),
      bonusTokens: 100, // Reward for sharing
    };
  }

  generateShareUrls(message: string) {
    const encoded = encodeURIComponent(message);
    return {
      twitter: `https://twitter.com/intent/tweet?text=${encoded}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=https://servalsheets.com&summary=${encoded}`,
    };
  }

  async rewardShare(customerId: string, platform: string) {
    // Verify share happened (check for mentions, etc.)
    // Credit bonus tokens
    await this.creditTokens(customerId, 100);

    // Track for analytics
    await this.trackShare(customerId, platform);
  }
}
```

### Viral Metrics Dashboard

```typescript
// src/viral/metrics.ts

export interface ViralMetrics {
  // Core viral metrics
  viralCoefficient: number; // K-factor: invites sent × conversion rate
  cycleTime: number; // Average time from signup to first referral (days)

  // Referral metrics
  totalReferrals: number;
  referralConversionRate: number;
  avgReferralsPerUser: number;

  // Attribution metrics
  organicSignups: number;
  referralSignups: number;
  paidSignups: number;

  // Engagement metrics
  shareRate: number; // % of users who share
  templateShares: number;
  socialMentions: number;
}

export async function calculateViralMetrics(): Promise<ViralMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get recent signups
  const recentSignups = await db.customers.count({
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Get referral data
  const referrals = await db.referrals.find({
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Get invite data
  const invitesSent = await db.invites.count({
    createdAt: { $gte: thirtyDaysAgo },
  });

  // Calculate K-factor
  const inviteConversionRate = referrals.length / invitesSent;
  const avgInvitesPerUser = invitesSent / recentSignups;
  const viralCoefficient = avgInvitesPerUser * inviteConversionRate;

  // Get attribution breakdown
  const signupSources = await db.customers.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: '$source', count: { $sum: 1 } } },
  ]);

  return {
    viralCoefficient,
    cycleTime: await this.calculateCycleTime(),
    totalReferrals: referrals.length,
    referralConversionRate: inviteConversionRate,
    avgReferralsPerUser: avgInvitesPerUser,
    organicSignups: signupSources.find((s) => s._id === 'organic')?.count || 0,
    referralSignups: signupSources.find((s) => s._id === 'referral')?.count || 0,
    paidSignups: signupSources.find((s) => s._id === 'paid')?.count || 0,
    shareRate: await this.calculateShareRate(),
    templateShares: await db.templateShares.count({ createdAt: { $gte: thirtyDaysAgo } }),
    socialMentions: await this.getSocialMentions(),
  };
}
```

---

## Part 4: Additional Features to Consider

### High-Priority Additions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FEATURE PRIORITY MATRIX                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  HIGH IMPACT + LOW EFFORT (Do First)                                    │
│  ├── Usage dashboard (show users their token consumption)               │
│  ├── Error rate reduction (14.6% → <5%)                                 │
│  ├── Template gallery (pre-built automations)                           │
│  └── Webhook notifications (real-time alerts)                           │
│                                                                          │
│  HIGH IMPACT + HIGH EFFORT (Plan For)                                   │
│  ├── Multi-tenancy (enterprise requirement)                             │
│  ├── Microsoft Excel support (2x market)                                │
│  ├── Self-hosted/on-premise option                                      │
│  └── SOC2 Type 2 certification                                          │
│                                                                          │
│  LOW IMPACT + LOW EFFORT (Nice to Have)                                 │
│  ├── Dark mode for docs                                                 │
│  ├── More chart types                                                   │
│  └── Keyboard shortcuts reference                                       │
│                                                                          │
│  LOW IMPACT + HIGH EFFORT (Avoid)                                       │
│  ├── Mobile app                                                         │
│  ├── Browser extension                                                  │
│  └── Native desktop app                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### User Dashboard Component

```typescript
// src/dashboard/userDashboard.ts

export interface DashboardData {
  // Usage
  tokensUsed: number;
  tokensLimit: number;
  tokensRemaining: number;
  resetDate: Date;

  // Activity
  operationsToday: number;
  operationsThisMonth: number;
  topActions: { action: string; count: number }[];

  // Health
  successRate: number;
  avgLatency: number;
  errors: { message: string; count: number }[];

  // Value
  estimatedTimeSaved: number; // minutes
  spreadsheetsAutomated: number;
}

export async function getDashboardData(customerId: string): Promise<DashboardData> {
  const customer = await db.customers.findById(customerId);
  const usage = await getUsageSummary(customerId);
  const activity = await getActivitySummary(customerId);

  return {
    tokensUsed: usage.monthlyTokens,
    tokensLimit: TIER_LIMITS[customer.tier].monthlyTokens,
    tokensRemaining: TIER_LIMITS[customer.tier].monthlyTokens - usage.monthlyTokens,
    resetDate: getNextMonthReset(),

    operationsToday: activity.today,
    operationsThisMonth: activity.month,
    topActions: activity.topActions,

    successRate: activity.successRate,
    avgLatency: activity.avgLatency,
    errors: activity.recentErrors,

    estimatedTimeSaved: calculateTimeSaved(activity.month),
    spreadsheetsAutomated: activity.uniqueSpreadsheets,
  };
}

function calculateTimeSaved(operations: number): number {
  // Estimate: each operation saves ~30 seconds of manual work
  return Math.round(operations * 0.5); // minutes
}
```

### Template Gallery System

```typescript
// src/templates/gallery.ts

interface Template {
  id: string;
  name: string;
  description: string;
  category: 'finance' | 'marketing' | 'sales' | 'hr' | 'operations';
  actions: TemplateAction[];
  author: string;
  usageCount: number;
  rating: number;
  tags: string[];
}

const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: 'monthly-report',
    name: 'Monthly Sales Report',
    description: 'Auto-generate monthly sales summary with charts',
    category: 'sales',
    actions: [
      { tool: 'sheets_data', action: 'read', params: { range: 'Sales!A:F' } },
      { tool: 'sheets_analyze', action: 'comprehensive' },
      { tool: 'sheets_visualize', action: 'chart_create', params: { chartType: 'LINE' } },
      { tool: 'sheets_visualize', action: 'pivot_create' },
    ],
    author: 'ServalSheets',
    usageCount: 0,
    rating: 0,
    tags: ['sales', 'reporting', 'charts'],
  },
  {
    id: 'expense-tracker',
    name: 'Expense Categorization',
    description: 'Auto-categorize expenses and create summary',
    category: 'finance',
    actions: [
      { tool: 'sheets_data', action: 'read' },
      { tool: 'sheets_analyze', action: 'detect_patterns' },
      { tool: 'sheets_data', action: 'write' },
      { tool: 'sheets_visualize', action: 'chart_create', params: { chartType: 'PIE' } },
    ],
    author: 'ServalSheets',
    usageCount: 0,
    rating: 0,
    tags: ['finance', 'expenses', 'categorization'],
  },
  // ... more templates
];

export class TemplateGallery {
  async listTemplates(category?: string, search?: string) {
    let templates = [...BUILT_IN_TEMPLATES, ...(await this.getUserTemplates())];

    if (category) {
      templates = templates.filter((t) => t.category === category);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.includes(searchLower))
      );
    }

    return templates.sort((a, b) => b.usageCount - a.usageCount);
  }

  async applyTemplate(templateId: string, spreadsheetId: string, customerId: string) {
    const template = await this.getTemplate(templateId);

    // Execute each action in sequence
    const results = [];
    for (const action of template.actions) {
      const result = await executeAction(action, spreadsheetId, customerId);
      results.push(result);
    }

    // Track usage
    await this.incrementUsage(templateId);

    return results;
  }

  async saveAsTemplate(
    customerId: string,
    name: string,
    description: string,
    actions: TemplateAction[],
    isPublic: boolean
  ) {
    return db.userTemplates.create({
      customerId,
      name,
      description,
      actions,
      isPublic,
      usageCount: 0,
      rating: 0,
      createdAt: new Date(),
    });
  }
}
```

### Error Rate Reduction Plan

```typescript
// src/reliability/errorHandling.ts

// Current issues identified:
// 1. Rate limiting not handled gracefully
// 2. Token refresh race conditions
// 3. Timeout errors on large operations
// 4. Retry logic not comprehensive

export class ReliabilityEnhancements {
  // 1. Exponential backoff with jitter
  async executeWithRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = this.calculateDelay(attempt, error);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private isRetryable(error: any): boolean {
    const retryableCodes = [429, 500, 502, 503, 504];
    const retryableMessages = ['ECONNRESET', 'ETIMEDOUT', 'rate limit'];

    return (
      retryableCodes.includes(error.code) ||
      retryableMessages.some((msg) => error.message?.includes(msg))
    );
  }

  private calculateDelay(attempt: number, error: any): number {
    // Check for Retry-After header
    if (error.retryAfter) {
      return error.retryAfter * 1000;
    }

    // Exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 32000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = Math.random() * 1000;

    return exponentialDelay + jitter;
  }

  // 2. Circuit breaker for sustained failures
  private circuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  });

  async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    if (this.circuitBreaker.isOpen()) {
      throw new Error('Service temporarily unavailable. Please try again later.');
    }

    try {
      const result = await operation();
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  // 3. Request deduplication
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicatedRequest<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    const promise = operation().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}
```

---

## Summary: Implementation Roadmap

### Week 1-2: Protection & Billing Foundation

- [ ] Implement license key validation
- [ ] Set up Stripe products/prices
- [ ] Create usage tracking system
- [ ] Add feature gating by tier

### Week 3-4: Viral Mechanics

- [ ] Implement referral system
- [ ] Add social sharing prompts
- [ ] Create powered-by attribution (free tier)
- [ ] Build referral dashboard

### Week 5-6: User Experience

- [ ] Build usage dashboard
- [ ] Create template gallery (5 templates)
- [ ] Reduce error rate to <5%
- [ ] Add reliability enhancements

### Week 7-8: Launch Preparation

- [ ] Deploy hosted version
- [ ] Set up monitoring (Sentry, Prometheus)
- [ ] Create onboarding flow
- [ ] Soft launch to beta users

---

_This implementation guide provides the technical foundation for a protected, monetized, viral product._
