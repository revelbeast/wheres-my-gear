export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const url = new URL(path);
    const intentPath = url.hostname || url.pathname.replace(/^\/+/, "");

    switch (intentPath) {
      case "dashboard":
        return "/(tabs)";
      case "add-item":
        return "/(tabs)/inventory";
      case "scanner":
        return "/scan-item";
      case "gear-assistant":
        return "/(tabs)?quickAction=gearAssistant";
      case "search": {
        const query = url.searchParams.get("query");
        return query
          ? `/(tabs)/inventory?query=${encodeURIComponent(query)}`
          : "/(tabs)/inventory";
      }
      case "checklist":
        return "/(tabs)/checklists";
      case "trip-prep":
        return "/(tabs)/trips";
      default:
        return path;
    }
  } catch {
    return path;
  }
}
