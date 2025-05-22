// Defines the PropertyIdentificationAgent class, responsible for identifying property details.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent";
import { extract_text_from_html } from "./extraction_utils"; // Import extraction utility

/**
 * PropertyIdentificationAgent is specialized in using research capabilities
 * to find specific property identification data (like APN, owner) from public record portals.
 */
export class PropertyIdentificationAgent extends BaseAgent {
  private researchAgent: ResearchAgent;

  /**
   * Constructs a new PropertyIdentificationAgent instance.
   * @param id - The unique identifier for the agent.
   * @param researchAgent - An instance of ResearchAgent to be used for finding portals.
   */
  constructor(id: string, researchAgent: ResearchAgent) {
    super(id, "PropertyIdentificationAgent");
    this.researchAgent = researchAgent;
  }

  /**
   * Executes the property identification task.
   * @param task_description - Must be "get_property_identification_data".
   * @param context - An object containing { property_address: string, county: string, town: string }.
   * @returns Promise<any> - A promise that resolves with property identification data (currently simulated).
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`PropertyIdentificationAgent (${this.id}) received task: ${task_description} with context:`, context);

    try {
      if (task_description !== "get_property_identification_data") {
        this.status = AgentStatus.IDLE;
        console.warn(`PropertyIdentificationAgent (${this.id}): Unknown task: ${task_description}`);
        return { status: "error_unknown_task", message: `Unknown task for PropertyIdentificationAgent: ${task_description}` };
      }

      if (!context || !context.property_address || !context.county || !context.town) {
        this.status = AgentStatus.ERROR;
        const missingParams = ['property_address', 'county', 'town'].filter(p => !context?.[p]).join(', ');
        console.error(`PropertyIdentificationAgent (${this.id}): Missing required context parameters: ${missingParams}`);
        // Return a structured error instead of throwing
        return { 
            status: "error_missing_input", 
            message: `Missing required context parameters: ${missingParams} for task: ${task_description}`,
            context_received: context
        };
      }

      const { property_address, county, town } = context;

      // Step 1: Get list of potential portals
      // Use a more specific task string for ResearchAgent when finding portals
      const portalsResult = await this.researchAgent.execute_task("find_public_record_portals_for_eastern_massachusetts", {});
      
      let portalsToSearchInfo = "Portal search did not run or failed.";
      let relevantPortals: string[] = [];

      // Check for error from ResearchAgent first
      if (portalsResult.status.startsWith("error")) {
          portalsToSearchInfo = `ResearchAgent failed to find portals: ${portalsResult.message}`;
          console.error(`PropertyIdentificationAgent (${this.id}): ${portalsToSearchInfo}`);
          // Potentially return an error here if portal list is critical, or proceed with empty relevantPortals
      } else if (portalsResult.data?.portals) {
          const availablePortals: string[] = portalsResult.data.portals;
          portalsToSearchInfo = `Based on county '${county}' and town '${town}', prioritizing portals.`;
          
          availablePortals.forEach(portal => {
            const pLower = portal.toLowerCase();
            if (pLower.includes(county.toLowerCase()) || pLower.includes(town.toLowerCase()) || pLower.includes("masslandrecords") || pLower.includes("sec.state.ma.us/rod")) {
              relevantPortals.push(portal);
            }
          });

          if (relevantPortals.length > 0) {
            portalsToSearchInfo += ` Found relevant: ${relevantPortals.join(", ")}.`;
          } else {
            portalsToSearchInfo += " No specific county/town portals matched, trying statewide.";
             availablePortals.forEach(portal => {
               if (portal.includes("masslandrecords") || portal.includes("sec.state.ma.us/rod")) {
                  relevantPortals.push(portal);
               }
             });
             if (relevantPortals.length > 0) {
               portalsToSearchInfo += ` Checking statewide: ${relevantPortals.join(", ")}`;
             } else {
               portalsToSearchInfo += " No statewide portals found either.";
             }
          }
      } else {
          portalsToSearchInfo = "ResearchAgent found no portals or returned unexpected data structure.";
          console.warn(`PropertyIdentificationAgent (${this.id}): ${portalsToSearchInfo}`);
      }
      console.log(`PropertyIdentificationAgent (${this.id}): ${portalsToSearchInfo}`);

      // Step 2: Fetch and Parse Content from selected portals
      const searchResults: Array<{ portal_url: string; status: string; keywords_found?: string[]; notes: string; research_agent_error?: any; error_details?: string }> = [];
      let overallKeywordsFound = false;

      const portalsToAttempt = relevantPortals.slice(0, 2); 

      if (portalsToAttempt.length === 0) {
        console.log(`PropertyIdentificationAgent (${this.id}): No relevant portals identified to search.`);
        this.status = AgentStatus.IDLE;
        return {
          status: "success_real_data_no_portals_identified", // More specific status
          data: { property_address, county, town, search_results, portal_identification_log: portalsToSearchInfo },
          message: "No relevant public record portals were identified to search for the given criteria."
        };
      }
      
      console.log(`PropertyIdentificationAgent (${this.id}): Attempting to search the following portals: ${portalsToAttempt.join(', ')}`);

      for (const portalUrl of portalsToAttempt) {
        try {
          console.log(`PropertyIdentificationAgent (${this.id}): Contacting ResearchAgent for portal: ${portalUrl}`);
          const researchTaskDescription = `search_property_address_on_portal ${portalUrl} ${property_address}`;
          const researchResult = await this.researchAgent.execute_task(
            researchTaskDescription,
            { portal_url: portalUrl, address: property_address } // context for research agent
          );

          if (researchResult.status.startsWith("error")) {
            console.warn(`PropertyIdentificationAgent (${this.id}): ResearchAgent failed for ${portalUrl}. Status: ${researchResult.status}`);
            searchResults.push({
              portal_url: portalUrl,
              status: "error_dependency_research_failed",
              notes: `ResearchAgent failed to fetch or process ${portalUrl}.`,
              research_agent_error: researchResult
            });
            continue; // Move to the next portal
          }
          
          if (!researchResult.data?.html_content) {
            console.warn(`PropertyIdentificationAgent (${this.id}): ResearchAgent returned no HTML content from ${portalUrl}.`);
            searchResults.push({
              portal_url: portalUrl,
              status: "error_dependency_no_content",
              notes: `ResearchAgent returned no HTML content from ${portalUrl}.`,
              research_agent_error: researchResult // include for context
            });
            continue; // Move to the next portal
          }

          // Inner try-catch for processing the HTML content
          try {
            const htmlContent = researchResult.data.html_content;
            const textContent = extract_text_from_html(htmlContent).toLowerCase();
            
            const keywordsToScan = ["apn", "assessor parcel number", "parcel id", "owner name", "deed reference", "registry of deeds", "land records"];
            const foundKeywords: string[] = [];

            keywordsToScan.forEach(keyword => {
              if (textContent.includes(keyword)) {
                foundKeywords.push(keyword);
              }
            });

            if (foundKeywords.length > 0) {
              overallKeywordsFound = true;
              searchResults.push({
                portal_url: portalUrl,
                status: "success_real_data_keywords_found",
                keywords_found: foundKeywords,
                notes: "Successfully fetched and scanned content. Keywords indicate potential relevance."
              });
              console.log(`PropertyIdentificationAgent (${this.id}): Found keywords [${foundKeywords.join(', ')}] on ${portalUrl}`);
            } else {
              searchResults.push({
                portal_url: portalUrl,
                status: "success_real_data_no_keywords_found",
                notes: "Successfully fetched content, but no relevant keywords found after scan."
              });
              console.log(`PropertyIdentificationAgent (${this.id}): No specific keywords found on ${portalUrl}`);
            }
          } catch (processingError: any) {
            console.error(`PropertyIdentificationAgent (${this.id}): Error processing HTML from ${portalUrl}:`, processingError.message, processingError.stack);
            searchResults.push({
              portal_url: portalUrl,
              status: "error_internal_processing",
              notes: `Error processing content from ${portalUrl}.`,
              error_details: processingError.message
            });
          }
        } catch (loopError: any) { // Catch errors within the loop itself (e.g., if researchAgent.execute_task throws unexpectedly)
            console.error(`PropertyIdentificationAgent (${this.id}): Unexpected error during loop for portal ${portalUrl}:`, loopError.message, loopError.stack);
            searchResults.push({
              portal_url: portalUrl,
              status: "error_agent_internal_loop",
              notes: `Unexpected error while attempting to process portal ${portalUrl}.`,
              error_details: loopError.message
            });
        }
      }

      this.status = AgentStatus.IDLE;
      if (overallKeywordsFound) {
        return {
          status: "success_real_data_extraction_attempted",
          data: { property_address, county, town, search_results, portal_identification_log: portalsToSearchInfo },
          message: "Attempted to fetch and scan content from identified property portals. Some keywords found."
        };
      } else {
        return {
          status: "success_real_data_no_specific_info_extracted",
          data: { property_address, county, town, search_results, portal_identification_log: portalsToSearchInfo },
          message: "Could not extract specific property identification details (no relevant keywords found) from the initial scan of portal pages, or all portal searches failed."
        };
      }

    } catch (error: any) { // Main try-catch for setup errors or truly unexpected issues
      this.status = AgentStatus.ERROR;
      console.error(`PropertyIdentificationAgent (${this.id}) encountered an unhandled error:`, error.message, error.stack);
      return { 
        status: "error_agent_internal", 
        message: `PropertyIdentificationAgent failed to execute task '${task_description}' due to an internal error.`,
        error_details: error.message 
      };
    }
  }
}
