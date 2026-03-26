/**
 * ServalSheets — Compute Engine Math Helpers
 *
 * Statistical and machine learning operations: K-Means, regression, forecasting.
 */

export interface KMeansResult {
  clusters: Array<{ centroid: number[]; members: number[] }>;
  converged: boolean;
  iterations: number;
  error?: string;
  wcss?: number; // Within-cluster sum of squares
}

export class ComputeEngineMath {
  static kMeans(data: number[][], k: number, maxIterations: number = 100): KMeansResult {
    if (data.length === 0 || k <= 0 || k > data.length) {
      return {
        clusters: [],
        converged: false,
        iterations: 0,
        error: 'Invalid input: empty data or invalid k',
      };
    }

    // Initialize centroids randomly
    const centroids = this.initializeCentroids(data, k);
    let assignments: number[] = new Array(data.length).fill(0);
    let converged = false;
    let iteration = 0;
    let wcss = 0;

    for (iteration = 0; iteration < maxIterations && !converged; iteration++) {
      // Assign points to nearest centroid
      const newAssignments = data.map((point) =>
        this.nearestCentroid(point, centroids)
      );

      // Check convergence
      converged = this.arraysEqual(assignments, newAssignments);
      assignments = newAssignments;

      // Update centroids
      for (let i = 0; i < k; i++) {
        const members = data.filter((_, idx) => assignments[idx] === i);
        if (members.length > 0) {
          centroids[i] = this.computeMean(members);
        }
      }
    }

    // Compute WCSS (within-cluster sum of squares)
    wcss = 0;
    for (let i = 0; i < data.length; i++) {
      const centroid = centroids[assignments[i]];
      const distance = this.euclideanDistance(data[i], centroid);
      wcss += distance * distance;
    }

    // Build clusters
    const clusters = Array.from({ length: k }, (_, i) => ({
      centroid: centroids[i],
      members: data
        .map((_, idx) => (assignments[idx] === i ? idx : -1))
        .filter((idx) => idx !== -1),
    }));

    return {
      clusters,
      converged,
      iterations: iteration + 1,
      wcss,
    };
  }

  /**
   * Elbow method to determine optimal k.
   * Returns k with maximum elbow (sharpest inflection in wcss).
   */
  static findOptimalK(data: number[][], maxK: number = 10): number {
    const wcssList: number[] = [];

    for (let k = 1; k <= Math.min(maxK, data.length); k++) {
      const result = this.kMeans(data, k);
      wcssList.push(result.wcss ?? 0);
    }

    // Find elbow: maximum second derivative
    let maxInflection = 0;
    let optimalK = 1;

    for (let i = 1; i < wcssList.length - 1; i++) {
      // Guard against undefined wcss values
      const wcss_prev = wcssList[i - 1] ?? 0;
      const wcss_curr = wcssList[i] ?? 0;
      const wcss_next = wcssList[i + 1] ?? 0;

      const d1 = wcss_prev - wcss_curr;
      const d2 = wcss_curr - wcss_next;
      const inflection = Math.abs(d1 - d2);

      if (inflection > maxInflection) {
        maxInflection = inflection;
        optimalK = i + 1;
      }
    }

    return Math.max(1, optimalK);
  }

  private static initializeCentroids(data: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const indices = new Set<number>();

    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * data.length);
      if (!indices.has(idx)) {
        centroids.push([...data[idx]]);
        indices.add(idx);
      }
    }

    return centroids;
  }

  private static nearestCentroid(point: number[], centroids: number[][]): number {
    let nearest = 0;
    let minDistance = Infinity;

    for (let i = 0; i < centroids.length; i++) {
      const distance = this.euclideanDistance(point, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = i;
      }
    }

    return nearest;
  }

  private static euclideanDistance(p1: number[], p2: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(p1.length, p2.length); i++) {
      const diff = p1[i] - p2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private static computeMean(points: number[][]): number[] {
    if (points.length === 0) return [];
    const mean: number[] = new Array(points[0].length).fill(0);
    for (const point of points) {
      for (let i = 0; i < point.length; i++) {
        mean[i] += point[i];
      }
    }
    return mean.map((sum) => sum / points.length);
  }

  private static arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
