// Defines the ZoningDataAgent class, responsible for fetching initial zoning information.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent";
import { extract_text_from_html, extract_links_from_html } from "./extraction_utils"; // Import extraction utilities

/**
 * ZoningDataAgent is specialized in finding initial zoning information for a property,
 * such as its zoning district and links to relevant zoning ordinances or maps.
 */
export class ZoningDataAgent extends BaseAgent {
  private researchAgent: ResearchAgent;

  /**
   * Constructs a new ZoningDataAgent instance.
   * @param id - The unique identifier for the agent.
   * @param researchAgent - An instance of ResearchAgent to be used for finding town planning/GIS sites.
   */
  constructor(id: string, researchAgent: ResearchAgent) {
    super(id, "ZoningDataAgent");
    this.researchAgent = researchAgent;
  }

  /**
   * Executes the initial zoning data retrieval task.
   * @param task_description - Must be "get_zoning_data_initial".
   * @param context - An object containing { property_address: string, town: string }.
   * @returns Promise<any> - A promise that resolves with initial zoning data (currently simulated).
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`ZoningDataAgent (${this.id}) received task: ${task_description} with context:`, context);

    try {
      if (task_description !== "get_zoning_data_initial") {
        this.status = AgentStatus.IDLE;
        console.warn(`ZoningDataAgent (${this.id}): Unknown task: ${task_description}`);
        return { status: "error_unknown_task", message: `Unknown task for ZoningDataAgent: ${task_description}` };
      }

      if (!context || !context.property_address || !context.town) {
        this.status = AgentStatus.ERROR;
        const missingParams = ['property_address', 'town'].filter(p => !context?.[p]).join(', ');
        console.error(`ZoningDataAgent (${this.id}): Missing required context parameters: ${missingParams}`);
        // Return a structured error instead of throwing
        return { 
            status: "error_missing_input", 
            message: `Missing required context parameters: ${missingParams} for task: ${task_description}`,
            context_received: context 
        };
      }

      const { property_address, town } = context;

      // Step 1: Identify potential town planning/GIS website URL
      const portalResearchTask = "find_public_record_portals_for_eastern_massachusetts";
      const portalsResult = await this.researchAgent.execute_task(portalResearchTask, {});
      
      let targetTownWebsiteUrl: string | null = null;
      let townSiteInfoNotes = `Initial portal search for ${town} planning/GIS website.`;

      if (portalsResult.status.startsWith("error")) {
        townSiteInfoNotes = `ResearchAgent failed during portal identification (Task: ${portalResearchTask}): ${portalsResult.message}`;
        console.error(`ZoningDataAgent (${this.id}): ${townSiteInfoNotes}`);
        // Continue, as a default/generic search might still be attempted or it might fail at the next step.
      } else if (portalsResult.data?.portals) {
        const availablePortals: string[] = portalsResult.data.portals;
        const townSpecificPortal = availablePortals.find(portal => {
          const pLower = portal.toLowerCase();
          const townLower = town.toLowerCase();
          return pLower.includes(townLower) && 
                 (pLower.includes("gis") || pLower.includes("planning") || pLower.includes(townLower+".gov") || pLower.includes(townLower+".ma.us") || pLower.includes("ecode360") || pLower.includes("codepublishing"));
        });
        if (townSpecificPortal) {
          targetTownWebsiteUrl = townSpecificPortal;
          townSiteInfoNotes = `Identified potential town portal for ${town}: ${targetTownWebsiteUrl}.`;
        } else {
          townSiteInfoNotes = `No specific planning/GIS portal found for ${town} in the initial list.`;
        }
      } else {
        townSiteInfoNotes = "ResearchAgent portal search returned no portals or unexpected data structure.";
        console.warn(`ZoningDataAgent (${this.id}): ${townSiteInfoNotes}`);
      }
      console.log(`ZoningDataAgent (${this.id}): ${townSiteInfoNotes}`);

      if (!targetTownWebsiteUrl) {
        console.log(`ZoningDataAgent (${this.id}): No target town website URL identified for ${town}.`);
        this.status = AgentStatus.IDLE;
        return {
          status: "error_no_zoning_portal_identified",
          message: `Could not identify a specific town website for ${town} for zoning information. Log: ${townSiteInfoNotes}`,
          data: { property_address, town, portal_identification_log: townSiteInfoNotes }
        };
      }

      console.log(`ZoningDataAgent (${this.id}): Attempting to fetch and scan ${targetTownWebsiteUrl} for zoning info related to ${property_address}.`);

      // Step 2: Fetch and Parse Content from the identified town website
      const researchTaskForPortal = `search_property_address_on_portal ${targetTownWebsiteUrl} ${property_address}`;
      const researchResult = await this.researchAgent.execute_task(
        researchTaskForPortal, 
        { portal_url: targetTownWebsiteUrl, address: property_address }
      );

      if (researchResult.status.startsWith("error")) {
        console.warn(`ZoningDataAgent (${this.id}): ResearchAgent failed for ${targetTownWebsiteUrl}. Status: ${researchResult.status}`);
        this.status = AgentStatus.IDLE;
        return {
          status: "error_dependency_research_failed",
          message: `ResearchAgent failed to fetch or process data from ${targetTownWebsiteUrl}.`,
          research_agent_error: researchResult,
          portal_url_searched: targetTownWebsiteUrl
        };
      }
      
      if (!researchResult.data?.html_content) {
        console.warn(`ZoningDataAgent (${this.id}): ResearchAgent returned no HTML content from ${targetTownWebsiteUrl}.`);
        this.status = AgentStatus.IDLE;
        return {
          status: "error_dependency_no_content",
          message: `ResearchAgent returned no HTML content from ${targetTownWebsiteUrl}.`,
          research_agent_response: researchResult,
          portal_url_searched: targetTownWebsiteUrl
        };
      }
      
      try {
        const htmlContent = researchResult.data.html_content;
        const textContent = extract_text_from_html(htmlContent).toLowerCase();
        const allLinks = extract_links_from_html(htmlContent, targetTownWebsiteUrl);

        const textKeywordsToScan = ["zoning", "planning department", "gis", "maps", "bylaw", "ordinance", "permitting", "land use", "regulations"];
        const foundTextKeywords: string[] = [];
        textKeywordsToScan.forEach(keyword => {
          if (textContent.includes(keyword)) {
            foundTextKeywords.push(keyword);
          }
        });

        const linkKeywordsToScan = ["zoning", "ordinance", "bylaw", "map", "gis", "planning", "regulation", "code", "permit"];
        const relevantLinks: Array<{text: string, href: string}> = [];
        allLinks.forEach(link => {
          const linkTextLower = link.text.toLowerCase();
          const linkHrefLower = link.href.toLowerCase();
          if (linkKeywordsToScan.some(keyword => linkTextLower.includes(keyword) || linkHrefLower.includes(keyword))) {
            relevantLinks.push(link);
          }
        });

        this.status = AgentStatus.IDLE;

        if (foundTextKeywords.length > 0 || relevantLinks.length > 0) {
          console.log(`ZoningDataAgent (${this.id}): Found text keywords [${foundTextKeywords.join(', ')}] and/or ${relevantLinks.length} relevant links on ${targetTownWebsiteUrl}`);
          return {
            status: "success_real_data_extraction_attempted", // Consistent success status
            data: {
              property_address, town,
              portal_url_searched: targetTownWebsiteUrl,
              keywords_found: foundTextKeywords,
              relevant_links: relevantLinks,
              notes: "Successfully fetched and scanned content from town website."
            },
            message: "Attempted to fetch and scan content from identified town website for zoning information. Keywords and/or links found."
          };
        } else {
          console.log(`ZoningDataAgent (${this.id}): No specific zoning keywords or relevant links found on ${targetTownWebsiteUrl} after scan.`);
          return {
            status: "success_real_data_no_keywords_or_links_found", // More specific
            data: {
              property_address, town,
              portal_url_searched: targetTownWebsiteUrl,
              notes: "Successfully fetched content from town website, but no relevant zoning keywords or links found after scan."
            },
            message: "Could not extract specific zoning details or links from the town website."
          };
        }
      } catch (processingError: any) {
          this.status = AgentStatus.ERROR;
          console.error(`ZoningDataAgent (${this.id}): Error processing HTML from ${targetTownWebsiteUrl}:`, processingError.message, processingError.stack);
          return {
            status: "error_internal_processing",
            message: `An unexpected error occurred while processing data from ${targetTownWebsiteUrl}.`,
            error_details: processingError.message,
            portal_url_searched: targetTownWebsiteUrl
          };
      }

    } catch (error: any) { // Main try-catch for setup errors or truly unexpected issues
      this.status = AgentStatus.ERROR;
      console.error(`ZoningDataAgent (${this.id}) encountered an unhandled error:`, error.message, error.stack);
      return { 
        status: "error_agent_internal", 
        message: `ZoningDataAgent failed to execute task '${task_description}' due to an internal error.`,
        error_details: error.message 
      };
    }
  }
}
