/** Human wording for the pray function's typed `closingPrayerError` codes. */
export function describeClosingPrayerError(code: string): string {
  if (code === "timeout") return "The closing prayer line timed out before answering.";
  if (code === "empty") return "The closing prayer line answered with silence.";
  if (code.startsWith("upstream_")) {
    return `The closing prayer line was unavailable (status ${code.slice("upstream_".length)}).`;
  }
  return "The closing prayer line did not answer.";
}
