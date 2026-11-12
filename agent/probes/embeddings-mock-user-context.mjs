// Mock userContextService for the WP-D probe (aliased over the real module).
let signals = []
export function __setMockSignals(next) { signals = next }
export function getSignals(_type, _source, _limit) { return signals }
