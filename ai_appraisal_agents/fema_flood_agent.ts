// Defines the FEMAFloodAgent class, responsible for fetching flood zone data.

import { BaseAgent, AgentStatus } from "./base_agent";
import { ResearchAgent } from "./research_agent"; // Import ResearchAgent
import { extract_text_from_html, extract_tables_from_html } from "./extraction_utils"; // Import extraction utilities

/**
 * FEMAFloodAgent is specialized in fetching flood zone data from FEMA's
 * Flood Map Service Center (msc.fema.gov) by orchestrating with a ResearchAgent.
 */
export class FEMAFloodAgent extends BaseAgent {
  private researchAgent: ResearchAgent;

  /**
   * Constructs a new FEMAFloodAgent instance.
   * @param id - The unique identifier for the FEMA flood agent.
   * @param researchAgent - An instance of ResearchAgent to handle web queries.
   */
  constructor(id: string, researchAgent: ResearchAgent) {
    super(id, "FEMAFloodAgent"); // Call BaseAgent constructor with id and a fixed name.
    this.researchAgent = researchAgent;
  }

  /**
   * Executes a task to get flood zone data for a given property address
   * by using ResearchAgent to fetch HTML from FEMA's website and then attempting
   * to extract relevant information.
   * @param task_description - Must be "get_flood_zone_data".
   * @param context - An object containing task-specific data, must include { property_address: string }.
   * @returns Promise<any> - A promise that resolves with the task result.
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`FEMAFloodAgent (${this.id}) received task: ${task_description} for address: ${context?.property_address}`);

    if (task_description !== "get_flood_zone_data") {
      console.warn(`FEMAFloodAgent (${this.id}): Unknown task: ${task_description}`);
      this.status = AgentStatus.IDLE;
      return { status: "error_unknown_task", message: `Unknown task for FEMAFloodAgent: ${task_description}` };
    }

    if (!context || !context.property_address) {
      this.status = AgentStatus.ERROR;
      const errorMsg = `Missing property_address in context for task: ${task_description}`;
      console.error(`FEMAFloodAgent (${this.id}): ${errorMsg}`);
      return { status: "error_missing_input", message: errorMsg, context_received: context };
    }

    const propertyAddress = context.property_address;
    const femaSearchUrl = "https://msc.fema.gov/portal/search"; 

    try {
      console.log(`FEMAFloodAgent (${this.id}): Delegating to ResearchAgent to fetch URL: ${femaSearchUrl} for address: ${propertyAddress}`);
      
      const researchResult = await this.researchAgent.execute_task(
        `search_property_address_on_portal ${femaSearchUrl} ${propertyAddress}`, // Construct task string
        { portal_url: femaSearchUrl, address: propertyAddress } 
      );

      // Check if ResearchAgent encountered an error
      if (researchResult.status.startsWith("error")) {
        console.error(`FEMAFloodAgent (${this.id}): ResearchAgent failed. Status: ${researchResult.status}, Message: ${researchResult.message}`);
        this.status = AgentStatus.IDLE; // Or ERROR based on policy
        return { 
          status: "error_dependency_research_failed", 
          message: `Failed to retrieve data due to ResearchAgent failure for ${femaSearchUrl}.`,
          research_agent_error: researchResult 
        };
      }
      
      // Check if HTML content is present (ResearchAgent might succeed but not return HTML for some reason)
      if (!researchResult.data?.html_content) {
        console.warn(`FEMAFloodAgent (${this.id}): ResearchAgent succeeded but returned no HTML content from ${femaSearchUrl}. Full Response: ${JSON.stringify(researchResult)}`);
        this.status = AgentStatus.IDLE;
        return { 
          status: "error_dependency_no_content", 
          message: `ResearchAgent returned no HTML content from ${femaSearchUrl}.`,
          research_agent_response: researchResult
        };
      }
      
      // Inner try-catch for processing the HTML content
      try {
        console.log(`FEMAFloodAgent (${this.id}): Successfully received HTML content from ResearchAgent for ${femaSearchUrl}. Attempting extraction.`);
        const htmlContent = researchResult.data.html_content;
        const textContent = extract_text_from_html(htmlContent).toLowerCase();
        // const tables = extract_tables_from_html(htmlContent); // We might use tables later if needed

        const foundKeywords: string[] = [];
        let extractedData: any = {};

        if (textContent.includes("flood zone")) {
          foundKeywords.push("Flood Zone");
          extractedData.flood_zone = "Keyword 'Flood Zone' found"; 
        }
        if (textContent.includes("base flood elevation")) {
          foundKeywords.push("Base Flood Elevation");
          extractedData.base_flood_elevation = "Keyword 'Base Flood Elevation' found";
        }
        if (textContent.includes("map panel id") || textContent.includes("map panel")) {
          foundKeywords.push("Map Panel ID");
          extractedData.map_panel = "Keyword 'Map Panel ID' found";
        }
        if (textContent.includes("effective date") || textContent.includes("map effective")) {
          foundKeywords.push("Effective Date of Map");
          extractedData.effective_date = "Keyword 'Effective Date of Map' found";
        }

        this.status = AgentStatus.IDLE;

        if (foundKeywords.length > 0) {
          console.log(`FEMAFloodAgent (${this.id}): Found keywords: ${foundKeywords.join(', ')} in content from ${femaSearchUrl}`);
          return {
            status: "success_real_data_keywords_found", // More specific
            data: {
              ...extractedData, 
              source_url: femaSearchUrl,
              property_address: propertyAddress,
              notes: `Data keywords (${foundKeywords.join(', ')}) found via automated process from general search page. Specific values not fully extracted.`
            }
          };
        } else {
          console.log(`FEMAFloodAgent (${this.id}): No specific flood data keywords found in content from ${femaSearchUrl}.`);
          return {
            status: "success_real_data_no_keywords_found", // More specific
            data: {
              source_url: femaSearchUrl,
              property_address: propertyAddress,
              notes: "Successfully fetched FEMA page, but could not extract specific flood data fields/keywords from the general search page."
            }
          };
        }
      } catch (processingError: any) {
        this.status = AgentStatus.ERROR;
        console.error(`FEMAFloodAgent (${this.id}): Error processing HTML from ${femaSearchUrl}:`, processingError.message, processingError.stack);
        return {
          status: "error_internal_processing",
          message: `An unexpected error occurred while processing data from ${femaSearchUrl}.`,
          error_details: processingError.message,
          source_url: femaSearchUrl,
        };
      }

    } catch (error: any) { // Outer catch for issues like ResearchAgent call failing unexpectedly (not returning a structured response)
      this.status = AgentStatus.ERROR;
      console.error(`FEMAFloodAgent (${this.id}) encountered an unexpected error executing task '${task_description}':`, error.message, error.stack);
      return { 
        status: "error_agent_internal", 
        message: `FEMAFloodAgent failed to execute task '${task_description}' due to an internal error.`,
        error_details: error.message 
      };
    }
  }
}
