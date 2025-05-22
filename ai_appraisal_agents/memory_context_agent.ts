// Defines the MemoryContextAgent class, responsible for managing appraisal-related data.

import { BaseAgent, AgentStatus } from "./base_agent";

/**
 * MemoryContextAgent is specialized in storing, retrieving, and managing
 * data related to a specific appraisal context. It acts as a short-term memory
 * for the orchestrator or other agents during an appraisal process.
 */
export class MemoryContextAgent extends BaseAgent {
  private appraisal_data: Map<string, any>; // Stores data for the active appraisal context.

  /**
   * Constructs a new MemoryContextAgent instance.
   * @param id - The unique identifier for the memory context agent.
   */
  constructor(id: string) {
    super(id, "MemoryContextAgent"); // Call BaseAgent constructor with id and a fixed name.
    this.appraisal_data = new Map<string, any>();
  }

  /**
   * Executes tasks related to data management (set, get, clear).
   * @param task_description - Task to perform: "set_data", "get_data", or "clear_data".
   * @param context - An object containing task-specific data.
   *                  For "set_data": { key: string, value: any }
   *                  For "get_data": { key: string }
   *                  For "clear_data": { key?: string } (optional key for specific deletion)
   * @returns Promise<any> - A promise that resolves with the task result.
   */
  async execute_task(task_description: string, context: any): Promise<any> {
    this.status = AgentStatus.BUSY;
    console.log(`MemoryContextAgent (${this.id}) received task: ${task_description} with context:`, context);

    try {
      let result: any;

      switch (task_description) {
        case "set_data":
          if (!context || typeof context.key !== 'string') {
            throw new Error("Context must include a 'key' (string) for 'set_data' task.");
          }
          this.appraisal_data.set(context.key, context.value);
          result = { status: "success", message: `Data set for key: ${context.key}` };
          console.log(`MemoryContextAgent (${this.id}): Stored data for key '${context.key}'. Value:`, context.value);
          break;

        case "get_data":
          if (!context || typeof context.key !== 'string') {
            throw new Error("Context must include a 'key' (string) for 'get_data' task.");
          }
          const data = this.appraisal_data.get(context.key);
          if (data !== undefined) {
            result = { status: "success", message: `Data retrieved for key: ${context.key}`, data: data };
            console.log(`MemoryContextAgent (${this.id}): Retrieved data for key '${context.key}'. Value:`, data);
          } else {
            result = { status: "not_found", message: `No data found for key: ${context.key}`, data: null };
            console.log(`MemoryContextAgent (${this.id}): No data found for key '${context.key}'.`);
          }
          break;

        case "clear_data":
          if (context && typeof context.key === 'string') {
            this.appraisal_data.delete(context.key);
            result = { status: "success", message: `Data cleared for key: ${context.key}` };
            console.log(`MemoryContextAgent (${this.id}): Cleared data for key '${context.key}'.`);
          } else {
            this.appraisal_data.clear();
            result = { status: "success", message: "All appraisal data cleared." };
            console.log(`MemoryContextAgent (${this.id}): Cleared all appraisal data.`);
          }
          break;

        default:
          console.warn(`MemoryContextAgent (${this.id}): Unknown task description: ${task_description}`);
          this.status = AgentStatus.IDLE; // Not an error, just unknown task
          return { status: "failed", message: `Unknown task for MemoryContextAgent: ${task_description}` };
      }

      this.status = AgentStatus.IDLE;
      return result;
    } catch (error) {
      this.status = AgentStatus.ERROR;
      console.error(`MemoryContextAgent (${this.id}) encountered an error executing task '${task_description}':`, error);
      throw new Error(`MemoryContextAgent failed to execute task: ${task_description}. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
