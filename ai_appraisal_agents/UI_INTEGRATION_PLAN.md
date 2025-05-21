# UI Integration Plan for AI Appraisal Research

This document outlines the plan for integrating the AI Appraisal Research functionality into the user interface.

## 1. Access Point

-   **Method:** A new tab or main navigation item in the application.
-   **Label:** "AI Property Research" or "Automated Research Assistant".
-   **Placement:** Prominently in the main navigation bar or as a distinct section in a user dashboard.
-   **Rationale:** Provides clear visibility and easy access for users wanting to leverage the automated research capabilities.

## 2. User Input Interface

The user will be presented with a form containing the following fields to initiate a research task:

-   **Property Address:**
    -   Type: Text Input
    -   Label: "Property Address"
    -   Placeholder: e.g., "123 Main St"
    -   Validation: Required. Basic format validation (e.g., contains a number and a street name) might be useful.
-   **Town/Municipality:**
    -   Type: Text Input (initially), potentially a Dropdown (populated with MA towns if feasible).
    -   Label: "Town/City"
    -   Placeholder: e.g., "Boston"
    -   Validation: Required.
-   **County:**
    -   Type: Text Input (initially), potentially a Dropdown (populated with MA counties).
    -   Label: "County"
    -   Placeholder: e.g., "Suffolk"
    -   Validation: Required.
-   **State:**
    -   Type: Text Input (with default) or non-editable field.
    -   Label: "State"
    -   Default Value: "MA"
    -   Validation: Required (but pre-filled).
-   **Action Button:**
    -   Label: "Start Research"
    -   Action: Submits the form data to trigger the research process.

## 3. Display of Results

The `aggregated_data` JSON output from the `OrchestratorAgent` will be presented as follows:

-   **Initial Implementation (Basic Output for Validation):**
    -   The raw JSON data will be displayed in a formatted, human-readable way.
    -   Method: Using a `<pre>` tag with appropriate styling or a simple embedded JSON viewer component.
    -   Purpose: Allows for quick validation of the data being returned by the backend agents and is sufficient for initial internal testing and development.
    -   Example:
        ```json
        {
          "property_address": "100 Main Street, Weymouth, MA",
          "identification_data": { ... },
          "assessment_data": { ... },
          "zoning_data": { ... },
          "flood_data": { ... }
        }
        ```

-   **Future Considerations (User-Friendly Display):**
    -   Each key within the `aggregated_data` (e.g., `identification_data`, `assessment_data`, `zoning_data`, `flood_data`) will be rendered as a distinct section or "card."
    -   Within each section, data points will be displayed using appropriate UI elements:
        -   **Definition Lists:** For key-value pairs (e.g., APN: 123-456).
        -   **Tables:** For structured tabular data (if any section returns array-like data).
        -   **Links:** Render URLs as clickable links (e.g., zoning ordinance links).
    -   Visual cues (icons, section headers) to improve readability and data separation.
    -   A clear indication that the data is "Simulated" or "Placeholder" during initial phases.

## 4. Workflow/Interaction

The user interaction flow will be as follows:

1.  **Navigation:** User navigates to the "AI Property Research" section.
2.  **Input:** User fills in the property address, town, county, and state (MA default) in the provided form.
3.  **Initiation:** User clicks the "Start Research" button.
4.  **Feedback (Processing):**
    -   The UI will display a loading indicator (e.g., spinner, progress bar, or textual message like "Researching property data...").
    -   The "Start Research" button may be disabled to prevent multiple submissions.
5.  **Backend Request:** The frontend application makes an asynchronous request (e.g., POST) to a dedicated backend endpoint (e.g., `/api/ai_research/property`). The request payload will contain the user-provided input.
6.  **Backend Processing:** This backend endpoint will instantiate and invoke the `OrchestratorAgent` with the provided context.
7.  **Response and Display:**
    -   Upon successful completion by the `OrchestratorAgent`, the backend endpoint returns the `aggregated_data` JSON.
    -   The frontend receives the JSON and displays it as outlined in the "Display of Results" section.
    -   The loading indicator is hidden.
8.  **Status/Log Display (Optional but Recommended):**
    -   A designated area on the UI (e.g., a collapsible section or a toast notification area) could display status messages or key log entries from the `OrchestratorAgent`'s `summaryLog`. This would be helpful for debugging and providing transparency into the (simulated) process.

## 5. Error Handling (UI Perspective)

Errors encountered during the AI research process will be communicated to the user through:

-   **Input Validation Errors:**
    -   Displayed inline next to the respective input fields (e.g., "Property Address is required.").
    -   Prevent form submission until basic client-side validation passes.
-   **Backend/Agent Errors:**
    -   If the backend endpoint returns an error (e.g., from the `OrchestratorAgent` throwing an error, or a sub-agent failing):
        -   **Alert Messages/Notifications:** Prominent, non-modal notifications (e.g., "toast" notifications) or clear alert messages will be displayed to the user.
        -   Message Content: Should be user-friendly but informative. Examples:
            -   "An error occurred while researching property data. Please try again later."
            -   "Could not retrieve flood data for the specified address." (If specific error details are safe to display).
            -   "Validation Error: The provided address could not be processed."
    -   The loading indicator should be hidden.
    -   The UI should clearly indicate that the process failed and no data (or partial data, if applicable) is available.
-   **Network Errors:**
    -   Standard browser error handling for network issues (e.g., "Cannot connect to server").
    -   The UI should provide a way for the user to retry the action.

This plan provides a foundational approach for integrating the AI research agents into the UI, focusing on clear user input, understandable display of (initially simulated) results, and basic error communication.
