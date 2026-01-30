/**
 * Circuit Breaker Registry
 *
 * Global registry for tracking all circuit breakers in the application.
 * Allows endpoints to expose circuit breaker metrics for monitoring.
 */
import type { CircuitBreaker } from '../utils/circuit-breaker.js';
interface CircuitBreakerEntry {
    name: string;
    breaker: CircuitBreaker;
    description?: string;
}
declare class CircuitBreakerRegistry {
    private breakers;
    /**
     * Register a circuit breaker
     */
    register(name: string, breaker: CircuitBreaker, description?: string): void;
    /**
     * Unregister a circuit breaker
     */
    unregister(name: string): void;
    /**
     * Get all registered circuit breakers
     */
    getAll(): CircuitBreakerEntry[];
    /**
     * Get a specific circuit breaker by name
     */
    get(name: string): CircuitBreakerEntry | undefined;
    /**
     * Get statistics for all circuit breakers
     */
    getAllStats(): Record<string, unknown>;
    /**
     * Clear all registered circuit breakers (for testing)
     */
    clear(): void;
}
declare const registry: CircuitBreakerRegistry;
export { registry as circuitBreakerRegistry, type CircuitBreakerEntry };
//# sourceMappingURL=circuit-breaker-registry.d.ts.map