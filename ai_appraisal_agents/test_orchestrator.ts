// Test script for OrchestratorAgent and its integration with specialist agents.
// This script simulates a full property research workflow using the defined agents
// and logs the aggregated data output.
// To run: ts-node test_orchestrator.ts (ensure ts-node is installed: npm install -g ts-node)

import { OrchestratorAgent } from "./orchestrator_agent";
import { ResearchAgent } from "./research_agent";
import { PropertyIdentificationAgent } from "./property_identification_agent";
import { AssessmentDataAgent } from "./assessment_data_agent";
import { ZoningDataAgent } from "./zoning_data_agent";
import { FEMAFloodAgent } from "./fema_flood_agent";
import { MemoryContextAgent } from "./memory_context_agent";
import { Agent } from "./base_agent"; // Import Agent for typing specialistAgents array

/**
 * Main function to set up and run the OrchestratorAgent test.
 */
async function main() {
  console.log("Starting OrchestratorAgent test script...");

  // 1. Create instances of individual specialist agents
  const researchAgent = new ResearchAgent("researcher-001");
  // FEMAFloodAgent now requires ResearchAgent
  const femaFloodAgent = new FEMAFloodAgent("fema-flood-checker-001", researchAgent); 
  const memoryContextAgent = new MemoryContextAgent("memory-context-001");

  // Agents that depend on ResearchAgent
  const propertyIdentificationAgent = new PropertyIdentificationAgent("prop-identifier-001", researchAgent);
  const assessmentDataAgent = new AssessmentDataAgent("assessment-fetcher-001", researchAgent);
  const zoningDataAgent = new ZoningDataAgent("zoning-informer-001", researchAgent);

  // 2. Create an array of all specialist agents for the Orchestrator
  // The OrchestratorAgent constructor will identify specific types like FEMAFloodAgent and MemoryContextAgent.
  const specialistAgents: Agent[] = [
    researchAgent, // Included if orchestrator might use it directly, or for general listing
    femaFloodAgent,
    memoryContextAgent,
    propertyIdentificationAgent,
    assessmentDataAgent,
    zoningDataAgent
  ];

  // 3. Create an instance of the OrchestratorAgent
  const orchestratorAgent = new OrchestratorAgent("orchestrator-main", specialistAgents);

  // 4. Define a sample context for the task
  const samplePropertyContext = {
    property_address: "392 Libbey Parkway, Weymouth, MA 02189",
    town: "Weymouth",
    county: "Norfolk",
    // state: "MA" // Not explicitly needed by current agents but good for context
  };

  // 5. Define the task for the OrchestratorAgent
  const taskDescription = "process_property_for_appraisal_research";

  console.log(`\nExecuting task: "${taskDescription}" for address: "${samplePropertyContext.property_address}"...`);

  try {
    // 6. Call the OrchestratorAgent's execute_task method
    const result = await orchestratorAgent.execute_task(taskDescription, samplePropertyContext);

    // 7. Log the entire result, which should include the aggregated_data JSON
    console.log("\nOrchestratorAgent task execution completed.");
    console.log("Result:");
    console.dir(result, { depth: null }); // console.dir for better object visibility

    if (result && result.aggregated_data) {
        console.log("\n--- Extracted Aggregated Data ---");
        console.dir(result.aggregated_data, { depth: null });
        console.log("--- End of Aggregated Data ---");
    }


  } catch (error) {
    console.error("\nError during OrchestratorAgent task execution:", error);
  }

  console.log("\nOrchestratorAgent test script finished.");
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error in main function:", error);
});
