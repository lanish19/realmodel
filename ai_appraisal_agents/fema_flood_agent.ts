// Defines the FEMAFloodAgent class, responsible for fetching flood zone data.

import { BaseAgent, AgentStatus } from "./base_agent";

/**
 * FEMAFloodAgent is specialized in fetching flood zone data from FEMA's
 * Flood Map Service Center (msc.fema.gov).
 */
export class FEMAFloodAgent extends BaseAgent {
  /**
   * Constructs a new FEMAFloodAgent instance.
   * @param id - The unique identifier for the FEMA flood agent.
   */
  constructor(id: string) {
    super(id, "FEMAFloodAgent"); // Call BaseAgent constructor with id and a fixed name.
  }

  /**
   * Executes a task to get flood zone data for a given property address.
   * @param task_description - Must be "get_flood_zone_data".
   * @param context - An object containing task-specific data, must include { property_address: string }.
   * @returns Promise<any> - A promise that resolves with the task result.
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`FEMAFloodAgent (${this.id}) received task: ${task_description} for address: ${context?.property_address}`);

    try {
      if (task_description !== "get_flood_zone_data") {
        console.warn(`FEMAFloodAgent (${this.id}): Unknown task description: ${task_description}`);
        this.status = AgentStatus.IDLE; // Set to IDLE as it's not an error, just an unknown task for this agent
        return { status: "failed", message: `Unknown task for FEMAFloodAgent: ${task_description}` };
      }

      if (!context || !context.property_address) {
        this.status = AgentStatus.ERROR;
        console.error(`FEMAFloodAgent (${this.id}): Missing property_address in context for task: ${task_description}`);
        throw new Error("Property address is required in context for get_flood_zone_data.");
      }

      const propertyAddress = context.property_address;
      const message = `Would query FEMA MSC (msc.fema.gov) for property address: '${propertyAddress}'. Expected data format: { flood_zone: string, map_panel: string, effective_date: string }`;
      
      console.log(`FEMAFloodAgent (${this.id}): ${message}`);
      
      // Simulate async operation if needed, though for this placeholder it's not strictly necessary
      await new Promise(resolve => setTimeout(resolve, 50)); 

      this.status = AgentStatus.IDLE;
      return { 
        status: "pending_external_action", 
        message: message,
        data: {
          property_address: propertyAddress
        }
      };

    } catch (error) {
      this.status = AgentStatus.ERROR;
      console.error(`FEMAFloodAgent (${this.id}) encountered an error executing task '${task_description}':`, error);
      throw new Error(`FEMAFloodAgent failed to execute task: ${task_description}. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
