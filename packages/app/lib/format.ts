export function shortAddress(addr: string, chars = 5): string {
  if (!addr || addr.length < chars * 2 + 3) return addr;
  return `${addr.slice(0, chars + 1)}…${addr.slice(-chars)}`;
}

export function formatCountdown(targetTimestamp: number): string {
  const delta = targetTimestamp - Math.floor(Date.now() / 1000);
  if (delta <= 0) return "Expired";
  const h = Math.floor(delta / 3600);
  const m = Math.floor((delta % 3600) / 60);
  const s = delta % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function timeAgo(timestampMs: number): string {
  const delta = Math.floor((Date.now() - timestampMs) / 1000);
  if (delta < 60) return "just now";
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export const ESCROW_STATE_LABEL: Record<number, string> = {
  0: "Created",
  1: "Funded",
  2: "Completed",
  3: "Released",
  4: "Disputed",
  5: "Refunded",
  6: "Cancelled",
};
