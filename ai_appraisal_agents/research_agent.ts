// Defines the ResearchAgent class, responsible for online information retrieval.

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
          "http://www.masslandrecords.com/", // Statewide portal
          "https://www.norfolkdeeds.org/record_search/", // Norfolk County Registry of Deeds
          "https://www.suffolkdeeds.com/Search", // Suffolk County Registry of Deeds (covers Boston)
          "https://www.sec.state.ma.us/rod/rodidx.htm", // Links to all MA registries
          "https://www.cityofboston.gov/assessing/search/", // Boston Assessor's Database
          "https://www.weymouth.ma.us/assessor/pages/online-assessing-database" // Weymouth Assessor's Database
        ];
        result = { status: "success", data: { portals: portals } };
        console.log(`ResearchAgent (${this.id}) found portals:`, portals);
      } else if (task_description.startsWith("search_property_address_on_portal")) {
        // Example: "search_property_address_on_portal http://example-portal.com 123 Main St, Anytown, MA"
        const parts = task_description.split(" ");
        if (parts.length < 4) { // "search_property_address_on_portal" + url + at least one part for address
            throw new Error("Invalid task description for search_property_address_on_portal. Expected format: 'search_property_address_on_portal [portal_url] [address]'");
        }
        const portalUrl = parts[1];
        const address = parts.slice(2).join(" ");
        
        const message = `Would typically use a web search/scraping tool to search for address '${address}' on portal '${portalUrl}'.`;
        result = { status: "pending_external_action", message: message, data: { portal_url: portalUrl, address: address } };
        console.log(`ResearchAgent (${this.id}): ${message}`);
      } else {
        console.warn(`ResearchAgent (${this.id}): Unknown task description: ${task_description}`);
        result = { status: "failed", message: `Unknown task: ${task_description}` };
      }

      this.status = AgentStatus.IDLE;
      return result;
    } catch (error) {
      this.status = AgentStatus.ERROR;
      console.error(`ResearchAgent (${this.id}) encountered an error executing task '${task_description}':`, error);
      // In a real scenario, might throw the error or return a more specific error object.
      throw new Error(`ResearchAgent failed to execute task: ${task_description}. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
