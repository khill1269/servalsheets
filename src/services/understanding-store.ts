/**
 * Understanding Store
 *
 * Manages progressive understanding of spreadsheets through analysis.
 * Tracks hypotheses, confidence assessments, user context, and semantic index.
 */

export interface ConfidenceAssessment {
  aspect: string; // 'headers', 'data_types', 'structure', 'relationships'
  confidence: number; // 0-1
  evidence: string[];
  timestamp: number;
}

export interface Hypothesis {
  id: string;
  description: string;
  confidence: number;
  source: 'scout' | 'comprehensive' | 'user_feedback';
  supportingEvidence: string[];
  contradictingEvidence: string[];
  timestamp: number;
}

export interface UserContext {
  lastReadRange?: string;
  frequentRanges: string[];
  suggestedColumns?: string[];
  rejectedSuggestions: Set<string>; // IDs of suggestions user declined
  acceptedSuggestions: Set<string>; // IDs of suggestions user applied
}

export interface UnderstandingSnapshot {
  spreadsheetId: string;
  hypotheses: Hypothesis[];
  confidenceAssessments: ConfidenceAssessment[];
  userContext: UserContext;
  semanticIndex: Map<string, Set<string>>; // term -> column names
  lastUpdated: number;
  analysisHistory: Array<{ timestamp: number; type: string; duration: number }>;
}

export class UnderstandingStore {
  private snapshot: UnderstandingSnapshot;

  constructor(spreadsheetId: string) {
    this.snapshot = {
      spreadsheetId,
      hypotheses: [],
      confidenceAssessments: [],
      userContext: {
        frequentRanges: [],
        rejectedSuggestions: new Set(),
        acceptedSuggestions: new Set(),
      },
      semanticIndex: new Map(),
      lastUpdated: Date.now(),
      analysisHistory: [],
    };
  }

  /**
   * Initialize from scout analysis result
   */
  initFromScout(scoutResult: Record<string, unknown>): void {
    const columns = (scoutResult.columns as Array<{ name: string; type: string }>) ?? [];
    const rowCount = (scoutResult.rowCount as number) ?? 0;
    const hasHeaders = (scoutResult.hasHeaders as boolean) ?? true;

    // Generate initial hypotheses
    this.snapshot.hypotheses = [
      {
        id: 'h_headers_detected',
        description: hasHeaders ? 'Sheet has header row' : 'No header row detected',
        confidence: hasHeaders ? 0.95 : 0.7,
        source: 'scout',
        supportingEvidence: ['Row 1 contains text values'],
        contradictingEvidence: [],
        timestamp: Date.now(),
      },
      {
        id: 'h_data_size',
        description: `Sheet contains approximately ${rowCount} rows of data`,
        confidence: 0.9,
        source: 'scout',
        supportingEvidence: [`Metadata reports ${rowCount} rows`],
        contradictingEvidence: [],
        timestamp: Date.now(),
      },
    ];

    // Build semantic index from columns
    for (const col of columns) {
      const words = col.name.toLowerCase().split(/[\W_]+/);
      for (const word of words) {
        if (!this.snapshot.semanticIndex.has(word)) {
          this.snapshot.semanticIndex.set(word, new Set());
        }
        this.snapshot.semanticIndex.get(word)!.add(col.name);
      }
    }

    this.snapshot.lastUpdated = Date.now();
  }

  /**
   * Update from comprehensive analysis
   */
  updateFromComprehensive(analysisResult: Record<string, unknown>): void {
    const findings = (analysisResult.findings as Hypothesis[]) ?? [];
    const duration = (analysisResult.duration as number) ?? 0;

    // Merge findings with existing hypotheses
    for (const finding of findings) {
      const existing = this.snapshot.hypotheses.find((h) => h.id === finding.id);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, finding.confidence);
        existing.supportingEvidence = Array.from(
          new Set([...existing.supportingEvidence, ...finding.supportingEvidence])
        );
      } else {
        this.snapshot.hypotheses.push(finding);
      }
    }

    this.snapshot.analysisHistory.push({
      timestamp: Date.now(),
      type: 'comprehensive',
      duration,
    });

    // Update confidence assessments
    this.snapshot.confidenceAssessments.push({
      aspect: 'comprehensive_analysis',
      confidence: Math.min(...findings.map((f) => f.confidence)),
      evidence: findings.map((f) => f.description),
      timestamp: Date.now(),
    });

    this.snapshot.lastUpdated = Date.now();
  }

  /**
   * Integrate user feedback
   */
  integrateUserAnswers(userAnswers: Record<string, unknown>): void {
    // Update confidence based on user confirmation
    for (const [key, value] of Object.entries(userAnswers)) {
      if (typeof value === 'boolean' && value) {
        // User confirmed hypothesis
        const hypothesis = this.snapshot.hypotheses.find(
          (h) => h.id === key || h.description.includes(key as string)
        );
        if (hypothesis) {
          hypothesis.confidence = Math.min(1.0, hypothesis.confidence + 0.1);
          hypothesis.timestamp = Date.now();
        }
      }
    }
  }

  /**
   * Record user interaction
   */
  recordUserInteraction(type: 'read' | 'suggestion_accepted' | 'suggestion_rejected', data: unknown): void {
    if (type === 'read') {
      const range = (data as { range?: string })?.range;
      if (range && !this.snapshot.userContext.frequentRanges.includes(range)) {
        this.snapshot.userContext.frequentRanges.push(range);
      }
      this.snapshot.userContext.lastReadRange = range;
    } else if (type === 'suggestion_accepted') {
      const id = (data as { id?: string })?.id;
      if (id) {
        this.snapshot.userContext.acceptedSuggestions.add(id);
      }
    } else if (type === 'suggestion_rejected') {
      const id = (data as { id?: string })?.id;
      if (id) {
        this.snapshot.userContext.rejectedSuggestions.add(id);
      }
    }
  }

  /**
   * Get current understanding snapshot
   */
  getSnapshot(): UnderstandingSnapshot {
    return this.snapshot;
  }

  /**
   * Get confidence evolution timeline
   */
  getConfidenceTimeline(): ConfidenceAssessment[] {
    return this.snapshot.confidenceAssessments.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Serialize for session persistence
   */
  serialize(): string {
    return JSON.stringify({
      ...this.snapshot,
      semanticIndex: Array.from(this.snapshot.semanticIndex.entries()),
      userContext: {
        ...this.snapshot.userContext,
        rejectedSuggestions: Array.from(this.snapshot.userContext.rejectedSuggestions),
        acceptedSuggestions: Array.from(this.snapshot.userContext.acceptedSuggestions),
      },
    });
  }

  /**
   * Deserialize from session
   */
  static deserialize(data: string): UnderstandingStore {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const store = new UnderstandingStore(parsed.spreadsheetId as string);
    store.snapshot.hypotheses = (parsed.hypotheses as Hypothesis[]) ?? [];
    store.snapshot.confidenceAssessments = (parsed.confidenceAssessments as ConfidenceAssessment[]) ?? [];
    store.snapshot.analysisHistory = (parsed.analysisHistory as Array<{ timestamp: number; type: string; duration: number }>) ?? [];

    // Restore semantic index
    const indexData = parsed.semanticIndex as Array<[string, string[]]> | undefined;
    if (indexData) {
      for (const [term, columns] of indexData) {
        store.snapshot.semanticIndex.set(term, new Set(columns));
      }
    }

    return store;
  }
}
