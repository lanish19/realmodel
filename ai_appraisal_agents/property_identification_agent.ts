// Defines the PropertyIdentificationAgent class, responsible for identifying property details.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent";

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
        return { status: "failed", message: `Unknown task for PropertyIdentificationAgent: ${task_description}` };
      }

      if (!context || !context.property_address || !context.county || !context.town) {
        this.status = AgentStatus.ERROR;
        const missingParams = ['property_address', 'county', 'town'].filter(p => !context?.[p]).join(', ');
        console.error(`PropertyIdentificationAgent (${this.id}): Missing required context parameters: ${missingParams}`);
        throw new Error(`Missing required context parameters: ${missingParams} for task: ${task_description}`);
      }

      const { property_address, county, town } = context;

      // Step 1: Get list of potential portals
      const portalsResult = await this.researchAgent.execute_task("find_public_record_portals_for_eastern_massachusetts", {});
      
      let portalsToSearchInfo = "No portals found or ResearchAgent failed.";
      let relevantPortals: string[] = [];

      if (portalsResult && portalsResult.status === "success" && portalsResult.data?.portals) {
        const availablePortals: string[] = portalsResult.data.portals;
        portalsToSearchInfo = `Based on county '${county}' and town '${town}', would prioritize searching portals like: `;
        
        // Simple logic to select relevant portals (can be expanded)
        availablePortals.forEach(portal => {
          const pLower = portal.toLowerCase();
          if (pLower.includes(county.toLowerCase()) || pLower.includes(town.toLowerCase()) || pLower.includes("masslandrecords") || pLower.includes("sec.state.ma.us/rod")) {
            relevantPortals.push(portal);
          }
        });

        if (relevantPortals.length > 0) {
          portalsToSearchInfo += relevantPortals.join(", ") + ".";
        } else {
          portalsToSearchInfo += "none of the known portals specifically match the criteria, would check statewide portals.";
          // Fallback to statewide if specific ones aren't obvious
           availablePortals.forEach(portal => {
             if (portal.includes("masslandrecords") || portal.includes("sec.state.ma.us/rod")) {
                relevantPortals.push(portal);
             }
           });
           if (relevantPortals.length > 0) {
             portalsToSearchInfo += " Checking: " + relevantPortals.join(", ");
           }
        }
      }
      console.log(`PropertyIdentificationAgent (${this.id}): ${portalsToSearchInfo}`);

      // Step 2: Simulate searching these portals and finding data
      // In a real scenario, this would involve multiple calls to researchAgent with "search_property_address_on_portal"
      // and then using extraction_utils to parse the HTML results.

      const simulatedDeedReference = `SIMULATED_BOOK_${Math.floor(Math.random()*20000)}P${Math.floor(Math.random()*500)} (${county})`;
      const simulatedData = {
        property_address: property_address,
        apn: `SIMULATED_APN_${town.toUpperCase().substring(0,3)}${Math.floor(Math.random() * 90000) + 10000}`,
        owner_of_record: `SIMULATED OWNER ${String.fromCharCode(65 + Math.floor(Math.random() * 26))} HOLDINGS LLC`,
        lot_size_sf: `SIMULATED_${Math.floor(Math.random() * 5000 + 1000) * 10}_SF`,
        deed_reference: simulatedDeedReference,
        county: county,
        town: town,
      };

      const message = `Simulated search on portals: ${relevantPortals.length > 0 ? relevantPortals.join(', ') : 'general search'}.`;
      console.log(`PropertyIdentificationAgent (${this.id}): ${message}`);
      
      this.status = AgentStatus.IDLE;
      return {
        status: "success_simulated",
        data: simulatedData,
        message: message
      };

    } catch (error) {
      this.status = AgentStatus.ERROR;
      console.error(`PropertyIdentificationAgent (${this.id}) encountered an error:`, error);
      throw new Error(`PropertyIdentificationAgent failed to execute task '${task_description}'. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
