// Defines the AssessmentDataAgent class, responsible for fetching property assessment data.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent";

/**
 * AssessmentDataAgent is specialized in retrieving property assessment data
 * (e.g., assessed value, tax rate) from town/city assessor websites.
 */
export class AssessmentDataAgent extends BaseAgent {
  private researchAgent: ResearchAgent;

  /**
   * Constructs a new AssessmentDataAgent instance.
   * @param id - The unique identifier for the agent.
   * @param researchAgent - An instance of ResearchAgent to be used for finding assessor portals.
   */
  constructor(id: string, researchAgent: ResearchAgent) {
    super(id, "AssessmentDataAgent");
    this.researchAgent = researchAgent;
  }

  /**
   * Executes the assessment data retrieval task.
   * @param task_description - Must be "get_assessment_data".
   * @param context - An object containing { property_address: string, town: string }.
   * @returns Promise<any> - A promise that resolves with assessment data (currently simulated).
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`AssessmentDataAgent (${this.id}) received task: ${task_description} with context:`, context);

    try {
      if (task_description !== "get_assessment_data") {
        this.status = AgentStatus.IDLE;
        console.warn(`AssessmentDataAgent (${this.id}): Unknown task: ${task_description}`);
        return { status: "failed", message: `Unknown task for AssessmentDataAgent: ${task_description}` };
      }

      if (!context || !context.property_address || !context.town) {
        this.status = AgentStatus.ERROR;
        const missingParams = ['property_address', 'town'].filter(p => !context?.[p]).join(', ');
        console.error(`AssessmentDataAgent (${this.id}): Missing required context parameters: ${missingParams}`);
        throw new Error(`Missing required context parameters: ${missingParams} for task: ${task_description}`);
      }

      const { property_address, town } = context;

      // Step 1: Get list of potential portals to identify assessor sites
      const portalsResult = await this.researchAgent.execute_task("find_public_record_portals_for_eastern_massachusetts", {});
      
      let assessorSiteInfo = "No portals found or ResearchAgent failed. Cannot determine specific assessor site.";
      let targetPortal = `Generic Assessor Portal for ${town}`;

      if (portalsResult && portalsResult.status === "success" && portalsResult.data?.portals) {
        const availablePortals: string[] = portalsResult.data.portals;
        
        // Try to find a town-specific assessor portal
        const townSpecificPortal = availablePortals.find(portal => 
          portal.toLowerCase().includes(town.toLowerCase()) && 
          (portal.toLowerCase().includes("assessor") || portal.toLowerCase().includes("assessment"))
        );

        if (townSpecificPortal) {
          targetPortal = townSpecificPortal;
          assessorSiteInfo = `Identified potential assessor portal for ${town}: ${targetPortal}`;
        } else {
           // Fallback for common known portals if direct match failed
          const bostonAssessor = "https://www.cityofboston.gov/assessing/search/";
          const weymouthAssessor = "https://www.weymouth.ma.us/assessor/pages/online-assessing-database";
          if (town.toLowerCase() === "boston" && availablePortals.includes(bostonAssessor)) {
            targetPortal = bostonAssessor;
            assessorSiteInfo = `Identified specific assessor portal for ${town}: ${targetPortal}`;
          } else if (town.toLowerCase() === "weymouth" && availablePortals.includes(weymouthAssessor)) {
            targetPortal = weymouthAssessor;
            assessorSiteInfo = `Identified specific assessor portal for ${town}: ${targetPortal}`;
          } else {
            assessorSiteInfo = `No specific assessor portal found for ${town} in the known list. Would perform a general search or use a known statewide/county portal if applicable. Target assumed: ${targetPortal}`;
          }
        }
      }
      console.log(`AssessmentDataAgent (${this.id}): ${assessorSiteInfo}`);
      console.log(`AssessmentDataAgent (${this.id}): Would attempt to search for address '${property_address}' on '${targetPortal}'.`);

      // Step 2: Simulate searching this portal and finding data
      // In a real scenario, this would involve a call to researchAgent with "search_property_address_on_portal"
      // using the 'targetPortal' URL, and then using extraction_utils to parse the HTML results for assessment data.

      const simulatedData = {
        property_address: property_address,
        town: town,
        total_assessed_value: `SIMULATED_${Math.floor(Math.random() * 3000000 + 500000)}`, // Random value between 500k and 3.5M
        fiscal_year: `SIMULATED_${new Date().getFullYear() + 1}`, // Next fiscal year
        tax_rate_commercial: `SIMULATED_${(Math.random() * 10 + 10).toFixed(2)}`, // Random rate between 10.00 and 20.00
        annual_taxes: `SIMULATED_${Math.floor(Math.random() * 50000 + 5000)}` // Random taxes
      };
      
      // Calculate simulated annual taxes based on value and rate for more realism
      const assessedValue = parseFloat(simulatedData.total_assessed_value.replace("SIMULATED_", ""));
      const taxRate = parseFloat(simulatedData.tax_rate_commercial.replace("SIMULATED_", ""));
      if (!isNaN(assessedValue) && !isNaN(taxRate)) {
        simulatedData.annual_taxes = `SIMULATED_${((assessedValue / 1000) * taxRate).toFixed(0)}`;
      }

      const message = `Simulated search on ${town}'s Assessor site (${targetPortal}).`;
      console.log(`AssessmentDataAgent (${this.id}): ${message}`);
      
      this.status = AgentStatus.IDLE;
      return Promise.resolve({
        status: "success_simulated",
        data: simulatedData,
        message: message
      });

    } catch (error) {
      this.status = AgentStatus.ERROR;
      console.error(`AssessmentDataAgent (${this.id}) encountered an error:`, error);
      throw new Error(`AssessmentDataAgent failed to execute task '${task_description}'. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
