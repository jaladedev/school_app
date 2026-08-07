export function levelLabel(level: string): string {
  switch (level) {
    case "primary":
      return "Primary";
    case "jss":
      return "JSS";
    case "sss":
      return "SSS";
    default:
      return level;
  }
}
