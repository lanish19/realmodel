// Defines the ZoningDataAgent class, responsible for fetching initial zoning information.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent";

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
        return { status: "failed", message: `Unknown task for ZoningDataAgent: ${task_description}` };
      }

      if (!context || !context.property_address || !context.town) {
        this.status = AgentStatus.ERROR;
        const missingParams = ['property_address', 'town'].filter(p => !context?.[p]).join(', ');
        console.error(`ZoningDataAgent (${this.id}): Missing required context parameters: ${missingParams}`);
        throw new Error(`Missing required context parameters: ${missingParams} for task: ${task_description}`);
      }

      const { property_address, town } = context;

      // Step 1: Get list of potential portals (might include town websites)
      // This step is more for consistency, as direct town website search is more likely.
      const portalsResult = await this.researchAgent.execute_task("find_public_record_portals_for_eastern_massachusetts", {});
      
      let townSiteInfo = `Would target ${town}'s official website, specifically planning/GIS sections.`;
      if (portalsResult && portalsResult.status === "success" && portalsResult.data?.portals) {
        const availablePortals: string[] = portalsResult.data.portals;
        const townSpecificPortal = availablePortals.find(portal => 
          portal.toLowerCase().includes(town.toLowerCase()) && 
          (portal.toLowerCase().includes("gis") || portal.toLowerCase().includes("planning") || portal.toLowerCase().includes(town.toLowerCase()+".gov") || portal.toLowerCase().includes(town.toLowerCase()+".ma.us"))
        );
        if (townSpecificPortal) {
          townSiteInfo = `Identified potential town portal for ${town}: ${townSpecificPortal}. Would search for zoning information there.`;
        }
      }
      console.log(`ZoningDataAgent (${this.id}): ${townSiteInfo}`);

      // Step 2: Simulate searching the town's website
      console.log(`ZoningDataAgent (${this.id}): Would search ${town}'s Planning/GIS site for zoning district of '${property_address}'.`);
      console.log(`ZoningDataAgent (${this.id}): Would then attempt to find links for ${town}'s zoning ordinance and schedule of district regulations.`);

      // Step 3: Return hardcoded placeholder data
      const simulated_town_slug = town.toLowerCase().replace(/\s+/g, '_');
      const simulatedData = {
        property_address: property_address,
        town: town,
        zoning_district: `SIMULATED_R${Math.floor(Math.random()*20 + 10)} (${town} Residential District)`,
        ordinance_link: `SIMULATED_http://${simulated_town_slug}_ma_zoning_ordinance_link.com`,
        schedule_link: `SIMULATED_http://${simulated_town_slug}_ma_zoning_schedule_link.com`,
        map_link: `SIMULATED_http://${simulated_town_slug}_ma_zoning_map_link.com`
      };
      
      const message = `Simulated search on ${town}'s Planning/GIS site for zoning district and document links.`;
      console.log(`ZoningDataAgent (${this.id}): ${message}`);
      
      this.status = AgentStatus.IDLE;
      return Promise.resolve({
        status: "success_simulated",
        data: simulatedData,
        message: message
      });

    } catch (error) {
      this.status = AgentStatus.ERROR;
      console.error(`ZoningDataAgent (${this.id}) encountered an error:`, error);
      throw new Error(`ZoningDataAgent failed to execute task '${task_description}'. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
