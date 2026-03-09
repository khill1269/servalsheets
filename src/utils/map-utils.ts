/**
 * Bounded Map utilities for memory safety in long-running processes.
 *
 * @module utils/map-utils
 */

/**
 * Set a value in a Map with an upper bound on size.
 * When the map exceeds maxSize, the oldest entry (first key) is evicted.
 * This provides simple LRU-like behavior using Map's insertion order.
 *
 * @param map - The Map to set the value in
 * @param key - The key to set
 * @param value - The value to set
 * @param maxSize - Maximum number of entries (default: 10000)
 * @returns The evicted value if an entry was removed, undefined otherwise
 */
export function cappedMapSet<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  maxSize = 10000
): V | undefined {
  let evicted: V | undefined;
  if (map.size >= maxSize && !map.has(key)) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) {
      evicted = map.get(firstKey);
      map.delete(firstKey);
    }
  }
  map.set(key, value);
  return evicted;
}
