let counter = 0;

/** Monotonic-enough local id. No collisions within a device, which is all the PoC stores. */
export function uid(prefix = 'i'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}
