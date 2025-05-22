// Defines the OrchestratorAgent class responsible for coordinating specialist agents.

import { Agent, BaseAgent, AgentStatus } from "./base_agent";
import { FEMAFloodAgent } from "./fema_flood_agent";
import { MemoryContextAgent } from "./memory_context_agent";
import { PropertyIdentificationAgent } from "./property_identification_agent";
import { AssessmentDataAgent } from "./assessment_data_agent";
import { ZoningDataAgent } from "./zoning_data_agent";

/**
 * OrchestratorAgent coordinates tasks among various specialist AI agents.
 * It receives tasks, delegates them to appropriate specialist agents based on a predefined workflow,
 * and aggregates results.
 */
export class OrchestratorAgent extends BaseAgent {
  // Allows for a mix of general Agent types and specific known types for direct use
  private specialistAgents: Agent[];
  private femaFloodAgent: FEMAFloodAgent | undefined;
  private memoryContextAgent: MemoryContextAgent | undefined;
  private propertyIdentificationAgent: PropertyIdentificationAgent | undefined;
  private assessmentDataAgent: AssessmentDataAgent | undefined;
  private zoningDataAgent: ZoningDataAgent | undefined;


  /**
   * Constructs a new OrchestratorAgent instance.
   * @param id - The unique identifier for the orchestrator agent.
   * @param specialistAgents - An array of specialist agents that this orchestrator can delegate tasks to.
   *                           This can include instances of FEMAFloodAgent and MemoryContextAgent.
   */
  constructor(id: string, specialistAgents: Agent[]) {
    super(id, "OrchestratorAgent"); // Call BaseAgent constructor with id and a fixed name.
    this.specialistAgents = specialistAgents;

    // Explicitly find and assign specific agent types if they are provided
    this.femaFloodAgent = specialistAgents.find(agent => agent instanceof FEMAFloodAgent) as FEMAFloodAgent | undefined;
    this.memoryContextAgent = specialistAgents.find(agent => agent instanceof MemoryContextAgent) as MemoryContextAgent | undefined;
    this.propertyIdentificationAgent = specialistAgents.find(agent => agent instanceof PropertyIdentificationAgent) as PropertyIdentificationAgent | undefined;
    this.assessmentDataAgent = specialistAgents.find(agent => agent instanceof AssessmentDataAgent) as AssessmentDataAgent | undefined;
    this.zoningDataAgent = specialistAgents.find(agent => agent instanceof ZoningDataAgent) as ZoningDataAgent | undefined;
  }

  /**
   * Executes a given task by coordinating with specialist agents.
   * The current implementation simulates task delegation and a specific workflow for flood data.
   * @param task_description - A string describing the task (e.g., "process_property_for_appraisal_research").
   * @param context - An object containing task-specific data (e.g., { property_address: string, county: string, town: string }).
   * @returns Promise<any> - A promise that resolves with a message summarizing the actions.
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`OrchestratorAgent (${this.id}) received task: ${task_description} for address: ${context?.property_address}`);

    let summaryLog: string[] = [`OrchestratorAgent (${this.id}) started task: ${task_description}.`];

    try {
      if (task_description === "process_property_for_appraisal_research") {
        if (!context || !context.property_address || !context.county || !context.town) {
          throw new Error("Missing required context (property_address, county, town) for 'process_property_for_appraisal_research'.");
        }

        // Log planned delegations
        if (this.propertyIdentificationAgent) {
          const msg = `Planning to delegate to PropertyIdentificationAgent (${this.propertyIdentificationAgent.get_id()}) for property details.`;
          console.log(msg);
          summaryLog.push(msg);
        } else {
          const msg = "PropertyIdentificationAgent not available for delegation.";
          console.warn(msg);
          summaryLog.push(msg);
        }

        if (this.assessmentDataAgent) {
          const msg = `Planning to delegate to AssessmentDataAgent (${this.assessmentDataAgent.get_id()}) for assessment data.`;
          console.log(msg);
          summaryLog.push(msg);
        } else {
          const msg = "AssessmentDataAgent not available for delegation.";
          console.warn(msg);
          summaryLog.push(msg);
        }

        if (this.zoningDataAgent) {
          const msg = `Planning to delegate to ZoningDataAgent (${this.zoningDataAgent.get_id()}) for zoning information.`;
          console.log(msg);
          summaryLog.push(msg);
        } else {
          const msg = "ZoningDataAgent not available for delegation.";
          console.warn(msg);
          summaryLog.push(msg);
        }

        // FEMA Flood Data Simulation
        if (this.femaFloodAgent && this.memoryContextAgent) {
          const femaTaskDescription = "get_flood_zone_data";
          const femaContext = { property_address: context.property_address };
          
          const msgFemaCall = `Delegating to FEMAFloodAgent (${this.femaFloodAgent.get_id()}) for task: ${femaTaskDescription}.`;
          console.log(msgFemaCall);
          summaryLog.push(msgFemaCall);

          const femaResult = await this.femaFloodAgent.execute_task(femaTaskDescription, femaContext);
          const msgFemaResult = `FEMAFloodAgent returned: ${JSON.stringify(femaResult)}`;
          console.log(msgFemaResult);
          summaryLog.push(msgFemaResult);

          // Store the direct result from FEMAFloodAgent (which now contains actual data or status)
          // The MemoryContextAgent is primarily for inter-task memory or complex state.
          // For direct aggregation, we'll use the femaResult later in the aggregation step.
          // If MemoryContextAgent were to be used here, it would store femaResult.data or femaResult itself.
          // For now, we'll remove the explicit memory set here and use the result directly.
          
          // The following MemoryContextAgent call for 'set_data' with simulatedFloodData is removed.
          // We'll handle femaResult in the aggregation phase.

          summaryLog.push(`FEMAFloodAgent processing complete. Actual data/status captured in femaResult.`);

        } else {
          const msgNoFemaOrMemory = "FEMAFloodAgent not available for flood data workflow.";
          console.warn(msgNoFemaOrMemory);
          summaryLog.push(msgNoFemaOrMemory);
        }

      } else {
        // Generic delegation log for other tasks
        let delegationLog = "Orchestrator would delegate to: ";
        if (this.specialistAgents.length === 0) {
          delegationLog += "no specialist agents available.";
        } else {
          delegationLog += this.specialistAgents.map(agent => agent.get_name()).join(", ") + ".";
        }
        console.log(`OrchestratorAgent (${this.id}): ${delegationLog}`);
        summaryLog.push(delegationLog);
      }

      // Simulate task execution time for the overall orchestration
      await new Promise(resolve => setTimeout(resolve, 100));

      // --- Data Aggregation ---
      let aggregatedData: any = {
        property_address: context.property_address
      };

      // Call PropertyIdentificationAgent
      if (this.propertyIdentificationAgent) {
        const idContext = { property_address: context.property_address, county: context.county, town: context.town };
        const idResult = await this.propertyIdentificationAgent.execute_task("get_property_identification_data", idContext);
        aggregatedData.identification_data = idResult?.data || "PropertyIdentificationAgent not executed or no data returned";
        summaryLog.push(`PropertyIdentificationAgent result: ${JSON.stringify(idResult?.status)}`);
      }

      // Call AssessmentDataAgent
      if (this.assessmentDataAgent) {
        const assessContext = { property_address: context.property_address, town: context.town };
        const assessResult = await this.assessmentDataAgent.execute_task("get_assessment_data", assessContext);
        aggregatedData.assessment_data = assessResult?.data || "AssessmentDataAgent not executed or no data returned";
        summaryLog.push(`AssessmentDataAgent result: ${JSON.stringify(assessResult?.status)}`);
      }

      // Call ZoningDataAgent
      if (this.zoningDataAgent) {
        const zoningContext = { property_address: context.property_address, town: context.town };
        const zoningResult = await this.zoningDataAgent.execute_task("get_zoning_data_initial", zoningContext);
        aggregatedData.zoning_data = zoningResult?.data || "ZoningDataAgent not executed or no data returned";
        summaryLog.push(`ZoningDataAgent result: ${JSON.stringify(zoningResult?.status)}`);
      }
      
      // Retrieve Flood Data (now directly from femaResult if FEMAFloodAgent was called in this task)
      // This assumes femaResult is available in this scope. If FEMAFloodAgent is called
      // as part of the main sequence like other agents, its result will be added directly.
      // For this refactor, we'll add a specific step for FEMA if it was called earlier.
      // However, the more common pattern would be to call it along with other agents below.
      // Let's adjust to call FEMA agent along with others for cleaner aggregation.
      
      // --- Data Aggregation ---
      let aggregatedData: any = {
        property_address: context.property_address,
        county: context.county,
        town: context.town,
        identification_data: { status: "not_executed", message: "PropertyIdentificationAgent not available or not run." },
        assessment_data: { status: "not_executed", message: "AssessmentDataAgent not available or not run." },
        zoning_data: { status: "not_executed", message: "ZoningDataAgent not available or not run." },
        flood_data: { status: "not_executed", message: "FEMAFloodAgent not available or not run." }
      };

      // Helper function to process agent results for aggregation
      const processAgentResult = (result: any, agentName: string) => {
        summaryLog.push(`${agentName} result status: ${JSON.stringify(result?.status)}`);
        if (result && result.status && (result.status.startsWith("success_real_data") || result.status.startsWith("success_simulated"))) { // success_simulated should be gone but good fallback
            return result.data || { status: result.status, message: `No data payload from ${agentName} despite success status.` };
        } else if (result) {
            return { status: result.status || "unknown_error", message: result.message || `${agentName} failed or returned incomplete data.`, full_result: result };
        }
        return { status: "error", message: `${agentName} execution failed or no result.` };
      };
      
      // Call PropertyIdentificationAgent
      if (this.propertyIdentificationAgent) {
        const idContext = { property_address: context.property_address, county: context.county, town: context.town };
        const idResult = await this.propertyIdentificationAgent.execute_task("get_property_identification_data", idContext);
        aggregatedData.identification_data = processAgentResult(idResult, "PropertyIdentificationAgent");
      }

      // Call AssessmentDataAgent
      if (this.assessmentDataAgent) {
        const assessContext = { property_address: context.property_address, town: context.town };
        const assessResult = await this.assessmentDataAgent.execute_task("get_assessment_data", assessContext);
        aggregatedData.assessment_data = processAgentResult(assessResult, "AssessmentDataAgent");
      }

      // Call ZoningDataAgent
      if (this.zoningDataAgent) {
        const zoningContext = { property_address: context.property_address, town: context.town };
        const zoningResult = await this.zoningDataAgent.execute_task("get_zoning_data_initial", zoningContext);
        aggregatedData.zoning_data = processAgentResult(zoningResult, "ZoningDataAgent");
      }
      
      // Call FEMAFloodAgent as part of the main data gathering sequence
      if (this.femaFloodAgent) {
        const femaTaskDescription = "get_flood_zone_data";
        const femaContext = { property_address: context.property_address };
        const femaResult = await this.femaFloodAgent.execute_task(femaTaskDescription, femaContext);
        // Specific handling for FEMAFloodAgent as per instructions
        if (femaResult && femaResult.status && femaResult.status.startsWith("success_real_data")) {
            aggregatedData.flood_data = femaResult.data || { status: femaResult.status, message: "No data payload from FEMAFloodAgent despite success status." };
        } else if (femaResult) {
            aggregatedData.flood_data = { status: femaResult.status || "unknown_error", message: femaResult.message || "FEMAFloodAgent failed or returned incomplete data.", full_result: femaResult };
        } else {
            aggregatedData.flood_data = { status: "error", message: "FEMAFloodAgent execution failed or no result."};
        }
        summaryLog.push(`FEMAFloodAgent result status: ${JSON.stringify(femaResult?.status)}`);
      }
      // Removed the MemoryContextAgent.get_data call for flood data as it's now directly aggregated.

      this.status = AgentStatus.IDLE;
      const finalMessage = `Real data appraisal research process attempted. Review aggregated_data for details.`;
      console.log(`OrchestratorAgent (${this.id}): ${finalMessage} Summary: ${summaryLog.join(" | ")}`);
      
      return {
        status: "success_real_data_attempted", // Updated status
        message: finalMessage,
        aggregated_data: aggregatedData
      };

    } catch (error: any) { // Ensure error is typed as any or unknown for broader compatibility
      this.status = AgentStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`OrchestratorAgent (${this.id}) encountered an error:`, errorMessage, error.stack); // Added stack for more detail
      summaryLog.push(`Error during orchestration: ${errorMessage}`);
      
      // Return a structured error object instead of throwing, to fulfill Promise<any>
      return { 
        status: "error_orchestrator_internal", // More specific error status
        message: `Orchestrator failed to execute task '${task_description}' due to an internal error. Error: ${errorMessage}`,
        summary: summaryLog.join(" | "),
        error_details: error 
      };
    }
  }
}
