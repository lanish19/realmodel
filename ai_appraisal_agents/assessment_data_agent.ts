// Defines the AssessmentDataAgent class, responsible for fetching property assessment data.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent";
import { extract_text_from_html } from "./extraction_utils"; // Import extraction utility

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
        return { status: "error_unknown_task", message: `Unknown task for AssessmentDataAgent: ${task_description}` };
      }

      if (!context || !context.property_address || !context.town) {
        this.status = AgentStatus.ERROR;
        const missingParams = ['property_address', 'town'].filter(p => !context?.[p]).join(', ');
        console.error(`AssessmentDataAgent (${this.id}): Missing required context parameters: ${missingParams}`);
        // Return a structured error instead of throwing
        return { 
            status: "error_missing_input", 
            message: `Missing required context parameters: ${missingParams} for task: ${task_description}`,
            context_received: context
        };
      }

      const { property_address, town } = context;

      // Step 1: Get list of potential portals to identify assessor sites
      const portalResearchTask = "find_public_record_portals_for_eastern_massachusetts";
      const portalsResult = await this.researchAgent.execute_task(portalResearchTask, {});
      
      let assessorSiteInfo = "Assessor portal identification did not run or failed.";
      let targetPortal: string | null = null; 

      if (portalsResult.status.startsWith("error")) {
        assessorSiteInfo = `ResearchAgent failed during portal identification (Task: ${portalResearchTask}): ${portalsResult.message}`;
        console.error(`AssessmentDataAgent (${this.id}): ${assessorSiteInfo}`);
        // Proceeding without a specific portal, will likely result in "no_portal_identified" later
      } else if (portalsResult.data?.portals) {
        const availablePortals: string[] = portalsResult.data.portals;
        const townSpecificPortal = availablePortals.find(portal => 
          portal.toLowerCase().includes(town.toLowerCase()) && 
          (portal.toLowerCase().includes("assessor") || portal.toLowerCase().includes("assessment"))
        );

        if (townSpecificPortal) {
          targetPortal = townSpecificPortal;
          assessorSiteInfo = `Identified potential assessor portal for ${town}: ${targetPortal}`;
        } else {
          const bostonAssessor = "https://www.cityofboston.gov/assessing/search/";
          const weymouthAssessor = "https://www.weymouth.ma.us/assessor/pages/online-assessing-database";
          if (town.toLowerCase() === "boston" && availablePortals.includes(bostonAssessor)) {
            targetPortal = bostonAssessor;
          } else if (town.toLowerCase() === "weymouth" && availablePortals.includes(weymouthAssessor)) {
            targetPortal = weymouthAssessor;
          }
          if (targetPortal) {
            assessorSiteInfo = `Identified specific assessor portal for ${town} via fallback: ${targetPortal}`;
          } else {
            assessorSiteInfo = `No specific assessor portal found for ${town} in the known list or fallbacks.`;
          }
        }
      } else {
        assessorSiteInfo = "ResearchAgent portal search returned no portals or unexpected data.";
        console.warn(`AssessmentDataAgent (${this.id}): ${assessorSiteInfo}`);
      }
      console.log(`AssessmentDataAgent (${this.id}): ${assessorSiteInfo}`);
      
      if (!targetPortal) {
          console.log(`AssessmentDataAgent (${this.id}): No specific assessor portal URL could be confidently identified for ${town}.`);
          this.status = AgentStatus.IDLE;
          return {
              status: "error_no_assessor_portal_identified", 
              message: `Could not identify a specific assessor portal for ${town}. Log: ${assessorSiteInfo}`,
              data: { property_address, town, portal_identification_log: assessorSiteInfo }
          };
      }
      
      console.log(`AssessmentDataAgent (${this.id}): Attempting to search for address '${property_address}' on identified portal: '${targetPortal}'.`);

      // Step 2: Fetch and Parse Content from the identified assessor portal
      const researchTaskForPortal = `search_property_address_on_portal ${targetPortal} ${property_address}`;
      const researchResult = await this.researchAgent.execute_task(
        researchTaskForPortal,
        { portal_url: targetPortal, address: property_address }
      );

      if (researchResult.status.startsWith("error")) {
        console.warn(`AssessmentDataAgent (${this.id}): ResearchAgent failed for ${targetPortal}. Status: ${researchResult.status}`);
        this.status = AgentStatus.IDLE;
        return { 
          status: "error_dependency_research_failed", 
          message: `ResearchAgent failed to fetch or process data from ${targetPortal}.`,
          research_agent_error: researchResult,
          portal_url_searched: targetPortal
        };
      }
      
      if (!researchResult.data?.html_content) {
        console.warn(`AssessmentDataAgent (${this.id}): ResearchAgent returned no HTML content from ${targetPortal}.`);
        this.status = AgentStatus.IDLE;
        return { 
          status: "error_dependency_no_content", 
          message: `ResearchAgent returned no HTML content from ${targetPortal}.`,
          research_agent_response: researchResult,
          portal_url_searched: targetPortal
        };
      }
      
      try {
        const htmlContent = researchResult.data.html_content;
        const textContent = extract_text_from_html(htmlContent).toLowerCase();
        const keywordsToScan = ["assessed value", "total assessment", "tax rate", "fiscal year", "property tax", "valuation"];
        const foundKeywords: string[] = [];

        keywordsToScan.forEach(keyword => {
          if (textContent.includes(keyword)) {
            foundKeywords.push(keyword);
          }
        });

        this.status = AgentStatus.IDLE;

        if (foundKeywords.length > 0) {
          console.log(`AssessmentDataAgent (${this.id}): Found keywords [${foundKeywords.join(', ')}] on ${targetPortal}`);
          return {
            status: "success_real_data_keywords_found",
            data: {
              property_address, town,
              portal_url_searched: targetPortal,
              keywords_found: foundKeywords,
              notes: "Successfully fetched and scanned content from assessor portal."
            },
            message: "Attempted to fetch and scan content from identified assessor portal. Keywords found."
          };
        } else {
          console.log(`AssessmentDataAgent (${this.id}): No specific assessment keywords found on ${targetPortal} after scan.`);
          return {
            status: "success_real_data_no_keywords_found",
            data: {
              property_address, town,
              portal_url_searched: targetPortal,
              notes: "Successfully fetched content from assessor portal, but no relevant assessment keywords found after scan."
            },
            message: "Could not extract specific assessment details (no relevant keywords found) from the assessor portal."
          };
        }
      } catch (processingError: any) {
        this.status = AgentStatus.ERROR;
        console.error(`AssessmentDataAgent (${this.id}): Error processing HTML from ${targetPortal}:`, processingError.message, processingError.stack);
        return {
          status: "error_internal_processing",
          message: `An unexpected error occurred while processing data from ${targetPortal}.`,
          error_details: processingError.message,
          portal_url_searched: targetPortal
        };
      }

    } catch (error: any) { // Main try-catch for setup errors or truly unexpected issues
      this.status = AgentStatus.ERROR;
      console.error(`AssessmentDataAgent (${this.id}) encountered an unhandled error:`, error.message, error.stack);
      return { 
        status: "error_agent_internal", 
        message: `AssessmentDataAgent failed to execute task '${task_description}' due to an internal error.`,
        error_details: error.message 
      };
    }
  }
}
