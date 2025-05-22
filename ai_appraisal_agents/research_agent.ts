// Defines the ResearchAgent class, responsible for online information retrieval.

import axios from 'axios';
import { BaseAgent, AgentStatus } from "./base_agent";

/**
 * ResearchAgent is specialized in finding information online,
 * such as public record portals or specific property details on those portals.
 */
export class ResearchAgent extends BaseAgent {
  /**
   * Constructs a new ResearchAgent instance.
   * @param id - The unique identifier for the research agent.
   */
  constructor(id: string) {
    super(id, "ResearchAgent"); // Call BaseAgent constructor with id and a fixed name.
  }

  /**
   * Executes a given research task.
   * @param task_description - A string describing the task.
   *                           Examples: "find_public_record_portals_for_eastern_massachusetts",
   *                                     "search_property_address_on_portal [portal_url] [address]"
   * @param context - An object containing task-specific data (e.g., { query: string, url: string }).
   * @returns Promise<any> - A promise that resolves with the task result.
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`ResearchAgent (${this.id}) received task: ${task_description} with context:`, context);

    try {
      let result: any;

      if (task_description === "find_public_record_portals_for_eastern_massachusetts") {
        const portals = [
          "http://www.masslandrecords.com/", 
          "https://www.norfolkdeeds.org/record_search/", 
          "https://www.suffolkdeeds.com/Search", 
          "https://www.sec.state.ma.us/rod/rodidx.htm", 
          "https://www.cityofboston.gov/assessing/search/", 
          "https://www.weymouth.ma.us/assessor/pages/online-assessing-database" 
        ];
        result = { status: "success_portals_found", data: { portals: portals } }; // Specific success status
        console.log(`ResearchAgent (${this.id}) found portals:`, portals);

      } else if (task_description.startsWith("search_property_address_on_portal")) {
        const parts = task_description.split(" ");
        // Expects "search_property_address_on_portal [portal_url] [optional_address...]"
        // At least "search_property_address_on_portal" and a URL are needed.
        if (parts.length < 2) { 
            this.status = AgentStatus.ERROR; // Set agent status
            return { 
                status: "error_invalid_task_input", 
                message: "Invalid task description for search_property_address_on_portal. Expected format: 'search_property_address_on_portal [portal_url] [optional_address]'",
                task_received: task_description
            };
        }
        const portalUrl = parts[1];
        // Address becomes optional context for the fetch, not necessarily part of the URL query construction here.
        const address = parts.length > 2 ? parts.slice(2).join(" ") : ""; 

        try {
          console.log(`ResearchAgent (${this.id}) attempting to fetch content from URL: ${portalUrl} (context address: '${address}')`);
          // Added timeout, and User-Agent header to mimic a browser and avoid some simple bot blocks.
          const response = await axios.get(portalUrl, { 
            timeout: 15000, // 15 seconds timeout
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          result = { 
            status: "success_url_fetched", // Specific success status
            data: { html_content: response.data, original_url: portalUrl, http_status_code: response.status } 
          };
          console.log(`ResearchAgent (${this.id}) successfully fetched content from ${portalUrl}. Status: ${response.status}`);
        } catch (axiosError: any) {
          const errorDetails = axiosError.isAxiosError ? axiosError.message : String(axiosError);
          const httpStatusCode = axiosError.isAxiosError ? axiosError.response?.status : null;
          console.error(`ResearchAgent (${this.id}) failed to fetch content from ${portalUrl}. Status: ${httpStatusCode}, Error: ${errorDetails}`);
          result = { 
            status: "error_fetching_url", 
            message: `Failed to fetch content from URL: ${portalUrl}. Error: ${errorDetails}`, 
            error_details: errorDetails,
            original_url: portalUrl,
            http_status_code: httpStatusCode
          };
        }
      } else {
        console.warn(`ResearchAgent (${this.id}): Unknown task description: ${task_description}`);
        // No specific agent status change here as it's a task type issue, not an execution error.
        result = { status: "error_unknown_task", message: `Unknown task: ${task_description}` };
      }

      this.status = AgentStatus.IDLE;
      return result;
    } catch (error: any) { // Catch-all for unexpected errors during task setup/validation (e.g., if split fails)
      this.status = AgentStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`ResearchAgent (${this.id}) encountered an unexpected error executing task '${task_description}':`, errorMessage, error.stack);
      return { // Return a structured error instead of throwing
        status: "error_agent_internal",
        message: `ResearchAgent failed to execute task '${task_description}' due to an internal error.`,
        error_details: errorMessage,
        task_received: task_description
      };
    }
  }
}
