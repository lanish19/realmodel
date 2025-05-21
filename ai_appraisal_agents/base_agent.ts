// Defines the core functionalities and properties of an AI agent.

/**
 * Enum representing the possible statuses of an agent.
 */
export enum AgentStatus {
  IDLE = "IDLE", // Agent is currently not performing any task.
  BUSY = "BUSY", // Agent is currently executing a task.
  ERROR = "ERROR", // Agent encountered an error during task execution.
}

/**
 * Interface defining the contract for all AI agents.
 * Ensures that all agents have a consistent set of methods for identification,
 * task execution, and status reporting.
 */
export interface Agent {
  /**
   * Returns a unique identifier for the agent.
   * @returns string - The unique ID of the agent.
   */
  get_id(): string;

  /**
   * Returns the name of the agent.
   * This name can be used to identify the type or specialty of the agent.
   * @returns string - The name of the agent (e.g., "ResearchAgent", "FEMAFloodMapAgent").
   */
  get_name(): string;

  /**
   * Executes a given task with the provided context.
   * This method is asynchronous and returns a Promise that resolves with the task's result.
   * @param task_description - A string describing the task to be performed.
   * @param context - An object containing any necessary information or data for the task.
   * @returns Promise<any> - A promise that resolves with the result of the task execution.
   */
  execute_task(task_description: string, context: any): Promise<any>;

  /**
   * Returns the current status of the agent.
   * @returns AgentStatus - The current status (IDLE, BUSY, or ERROR).
   */
  get_status(): AgentStatus;
}

/**
 * Abstract base class for AI agents, providing common implementations for the Agent interface.
 * Subclasses should extend this class and implement the `execute_task` method.
 */
export abstract class BaseAgent implements Agent {
  protected status: AgentStatus; // Current status of the agent.

  /**
   * Constructs a new BaseAgent instance.
   * @param id - The unique identifier for the agent.
   * @param name - The name of the agent.
   */
  constructor(protected id: string, protected name: string) {
    this.status = AgentStatus.IDLE; // Initialize status to IDLE.
  }

  /**
   * Returns the unique identifier of the agent.
   * @returns string - The agent's ID.
   */
  get_id(): string {
    return this.id;
  }

  /**
   * Returns the name of the agent.
   * @returns string - The agent's name.
   */
  get_name(): string {
    return this.name;
  }

  /**
   * Returns the current status of the agent.
   * @returns AgentStatus - The current status.
   */
  get_status(): AgentStatus {
    return this.status;
  }

  /**
   * Abstract method for task execution.
   * Subclasses must implement this method to define their specific task logic.
   * @param task_description - A string describing the task.
   * @param context - An object containing task-specific context.
   * @returns Promise<any> - A promise that resolves with the task result.
   */
  abstract execute_task(task_description: string, context: any): Promise<any>;
}
