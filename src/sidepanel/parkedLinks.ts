import { getParkedLinks, releaseParkedLinks } from "../api/parkedLinksApi";
import { ParkedLink } from "../types/index";

/**
 * Create the UI for showing parked links in the side panel
 */
export async function createParkedLinksUI(container: HTMLElement): Promise<void> {
  const parkedLinks = await getParkedLinks();
  
  // Create section for parked links
  const section = document.createElement("section");
  section.classList.add("parked-links-section");
  section.style.marginTop = "20px";
  section.style.borderTop = "1px solid #eee";
  section.style.paddingTop = "15px";
  
  // Section header
  const header = document.createElement("h3");
  header.textContent = "Parked for Later";
  header.style.fontSize = "16px";
  header.style.marginBottom = "10px";
  header.style.fontWeight = "bold";
  section.appendChild(header);

  // Show different UI depending on whether there are parked links
  if (parkedLinks.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No links have been parked yet.";
    emptyMessage.style.color = "#666";
    emptyMessage.style.fontSize = "14px";
    emptyMessage.style.fontStyle = "italic";
    section.appendChild(emptyMessage);
  } else {
    // Create a list for the parked links
    const linksList = document.createElement("ul");
    linksList.style.listStyle = "none";
    linksList.style.padding = "0";
    linksList.style.margin = "0";
    
    parkedLinks.forEach((link) => {
      const listItem = document.createElement("li");
      listItem.style.padding = "8px 0";
      listItem.style.borderBottom = "1px solid #f0f0f0";
      
      const linkTitle = document.createElement("div");
      linkTitle.textContent = link.title || link.url;
      linkTitle.style.fontSize = "14px";
      linkTitle.style.fontWeight = "500";
      linkTitle.style.textOverflow = "ellipsis";
      linkTitle.style.overflow = "hidden";
      linkTitle.style.whiteSpace = "nowrap";
      linkTitle.style.marginBottom = "4px";
      listItem.appendChild(linkTitle);
      
      const linkInfo = document.createElement("div");
      linkInfo.style.display = "flex";
      linkInfo.style.justifyContent = "space-between";
      linkInfo.style.fontSize = "12px";
      linkInfo.style.color = "#666";
      
      const contextSpan = document.createElement("span");
      contextSpan.textContent = link.context;
      linkInfo.appendChild(contextSpan);
      
      const timeSpan = document.createElement("span");
      const date = new Date(link.timestamp);
      timeSpan.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      linkInfo.appendChild(timeSpan);
      
      listItem.appendChild(linkInfo);
      linksList.appendChild(listItem);
    });
    
    section.appendChild(linksList);
    
    // Add a button to open all links
    const openAllBtn = document.createElement("button");
    openAllBtn.textContent = "Open All Links";
    openAllBtn.style.marginTop = "15px";
    openAllBtn.style.padding = "8px 12px";
    openAllBtn.style.backgroundColor = "#0066cc";
    openAllBtn.style.color = "#fff";
    openAllBtn.style.border = "none";
    openAllBtn.style.borderRadius = "4px";
    openAllBtn.style.cursor = "pointer";
    openAllBtn.style.fontWeight = "500";
    
    openAllBtn.addEventListener("click", async () => {
      try {
        await releaseParkedLinks();
        
        // Update the UI after opening links
        createParkedLinksUI(container);
      } catch (error) {
        console.error("Error opening parked links:", error);
      }
    });
    
    section.appendChild(openAllBtn);
  }
  
  // Clear existing content and append the new section
  container.innerHTML = "";
  container.appendChild(section);
}

/**
 * Initialize the parked links UI and set up refresh
 */
export function initParkedLinksUI(containerId: string): void {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("Container not found:", containerId);
    return;
  }
  
  // Initial UI creation
  createParkedLinksUI(container);
  
  // Refresh UI periodically
  setInterval(() => {
    createParkedLinksUI(container);
  }, 30000); // refresh every 30 seconds
} 