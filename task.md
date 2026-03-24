> **Role:** Act as a Senior Full-Stack Architect and Lead UI/UX Designer.
> **Task:** Perform an architectural and UI design deep-dive for the **Model Management Platform (MMP)** based on the provided specifications.
> **Step 1: Context Analysis**
> 1. Read all files in the `/MMP` folder.
> 2. Analyze `README.md` for existing conventions, tech stack preferences, and project guidelines.
> 
> 
> **Step 2: Architectural Design**
> * Propose a scalable system architecture (e.g., Clean Architecture or Layered Hexagonal).
> * Define the **Data Model** for Projects, Models, and Jobs (including the $6\sigma$ drift logic).
> * Design the **State Machine** for the Approval Workflow (Auto-approval vs. Manual Justification).
> * Detail the API contract or Service Layer requirements between the Frontend and Backend.
> 
> 
> **Step 3: UI/UX Conceptualization**
> * Design a "Modern Enterprise" visual language. Focus on **Data Density** without clutter.
> * Describe the **Model Training Dashboard**: How to visualize SHAP values, feature drift highlights, and performance metrics.
> * Plan the **Audit Trail UI**: How justifications and multi-role approvals are displayed.
> * *Constraint:* Ensure the UI feels "premium" (use principles like meaningful whitespace, consistent typography, and a "Dark Mode" first aesthetic if applicable).
> 
> 
> **Important Restrictions:**
> * **DO NOT** generate implementation code or boilerplate files yet.
> * **DO** provide a comprehensive technical design document in Markdown.
> * **DO** include a structured component tree and a description of the design tokens (colors, spacing, shadows).
> 
> 
> **Goal:** I want a blueprint so robust that we can move straight to implementation in the next turn.