/**
 * Circuit Breaker Registry
 *
 * Global registry for tracking all circuit breakers in the application.
 * Allows endpoints to expose circuit breaker metrics for monitoring.
 */
import { logger } from '../utils/logger.js';
class CircuitBreakerRegistry {
    breakers = new Map();
    /**
     * Register a circuit breaker
     */
    register(name, breaker, description) {
        this.breakers.set(name, { name, breaker, description });
        logger.debug('Circuit breaker registered', { name, description });
    }
    /**
     * Unregister a circuit breaker
     */
    unregister(name) {
        this.breakers.delete(name);
        logger.debug('Circuit breaker unregistered', { name });
    }
    /**
     * Get all registered circuit breakers
     */
    getAll() {
        return Array.from(this.breakers.values());
    }
    /**
     * Get a specific circuit breaker by name
     */
    get(name) {
        return this.breakers.get(name);
    }
    /**
     * Get statistics for all circuit breakers
     */
    getAllStats() {
        const stats = {};
        for (const [name, entry] of this.breakers) {
            stats[name] = entry.breaker.getStats();
        }
        return stats;
    }
    /**
     * Clear all registered circuit breakers (for testing)
     */
    clear() {
        this.breakers.clear();
    }
}
// Global singleton instance
const registry = new CircuitBreakerRegistry();
export { registry as circuitBreakerRegistry };
//# sourceMappingURL=circuit-breaker-registry.js.map