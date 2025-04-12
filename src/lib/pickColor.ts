export function pickColorForContext(context: string): chrome.tabGroups.ColorEnum {
  switch (context) {
    case "Work":
      return "yellow";
    case "Learning":
      return "blue";
    case "Entertainment":
      return "green";
    case "News":
      return "red";
    case "Shopping":
      return "purple";
    case "Social":
      return "cyan";
    case "Research":
      return "pink";
    case "Development":
      return "orange";
    default:
      return "grey";  // Chrome uses "grey" (British spelling) not "gray"
  }
}