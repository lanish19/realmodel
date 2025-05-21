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

          // Simulate receiving actual data after "pending_external_action"
          const simulatedFloodData = {
            flood_zone: "X (Simulated)",
            map_panel: "25000C0000X (Simulated)",
            effective_date: "2024-01-01 (Simulated)"
          };
          const msgSimulatedData = `Received simulated flood data: ${JSON.stringify(simulatedFloodData)}`;
          console.log(msgSimulatedData);
          summaryLog.push(msgSimulatedData);

          const memoryKey = `flood_data_${context.property_address.replace(/\s+/g, '_')}`;
          const memoryContext = { key: memoryKey, value: simulatedFloodData };
          const msgMemoryCall = `Calling MemoryContextAgent (${this.memoryContextAgent.get_id()}) to set data with key: ${memoryKey}.`;
          console.log(msgMemoryCall);
          summaryLog.push(msgMemoryCall);
          
          const memoryResult = await this.memoryContextAgent.execute_task("set_data", memoryContext);
          const msgMemoryResult = `MemoryContextAgent set_data result: ${JSON.stringify(memoryResult)}`;
          console.log(msgMemoryResult);
          summaryLog.push(msgMemoryResult);

        } else {
          const msgNoFemaOrMemory = "FEMAFloodAgent or MemoryContextAgent not available for full flood data workflow.";
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
      
      // Retrieve Flood Data from MemoryContextAgent
      if (this.memoryContextAgent) {
        const memoryKey = `flood_data_${context.property_address.replace(/\s+/g, '_')}`;
        const floodDataResult = await this.memoryContextAgent.execute_task("get_data", { key: memoryKey });
        aggregatedData.flood_data = floodDataResult?.data || "No flood data found in memory";
        summaryLog.push(`Retrieved flood_data from MemoryContextAgent (key ${memoryKey}): ${JSON.stringify(floodDataResult?.status)}`);
      } else {
        aggregatedData.flood_data = "MemoryContextAgent not available to retrieve flood data.";
        summaryLog.push("MemoryContextAgent not available to retrieve flood data.");
      }

      this.status = AgentStatus.IDLE;
      const finalMessage = `Simulated appraisal research process complete.`;
      console.log(`OrchestratorAgent (${this.id}): ${finalMessage} Summary: ${summaryLog.join(" | ")}`);
      
      return {
        status: "success_simulated",
        message: finalMessage,
        aggregated_data: aggregatedData
      };

    } catch (error) {
      this.status = AgentStatus.ERROR;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`OrchestratorAgent (${this.id}) encountered an error:`, errorMessage);
      summaryLog.push(`Error during orchestration: ${errorMessage}`);
      // Still throw, but ensure the return type matches the expected Promise<any> which could be an object
      throw { 
        status: "error",
        message: `Orchestrator failed to execute task: ${task_description}. Error: ${errorMessage}`,
        summary: summaryLog.join(" | ")
      };
    }
  }
}
