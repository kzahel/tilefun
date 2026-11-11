/** Sampled allocation estimates, including collected objects, not retained heap or GC time. */
export function allocationSummary(profile) {
  const byFrame = new Map();
  const visit = (node) => {
    const frame = node.callFrame;
    const key = JSON.stringify([
      frame.functionName,
      frame.url,
      frame.lineNumber,
      frame.columnNumber,
    ]);
    if (node.selfSize) {
      const entry = byFrame.get(key) ?? {
        function: frame.functionName || "(anonymous)",
        url: frame.url,
        line: frame.lineNumber + 1,
        column: frame.columnNumber + 1,
        sampledBytes: 0,
      };
      entry.sampledBytes += node.selfSize;
      byFrame.set(key, entry);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(profile.head);
  const entries = [...byFrame.values()].sort((a, b) => b.sampledBytes - a.sampledBytes);
  return {
    sampledBytes: entries.reduce((n, e) => n + e.sampledBytes, 0),
    top: entries.slice(0, 30),
  };
}
