# System Specification: Model Management Platform (MMP)

## 1. Executive Summary
The Model Management Platform (MMP) is a centralized UI application designed for the registration, governance, and audit of Machine Learning models. It facilitates lifecycle management, documentation compliance, and automated drift monitoring.

---

## 2. User Roles & Access Control
The platform operates on a Role-Based Access Control (RBAC) model:

| Role | Responsibility |
| :--- | :--- |
| **Admin** | Manages system-level entities; creates and configures **Projects**. |
| **Model Owner** | Registers **Models**; uploads compliance docs; provides justifications for data drift. |
| **Model Approver** | Acts as the final authority to "Approve" or "Reject" jobs with highlighted risks. |

---

## 3. Organizational Hierarchy
1. **Project (Parent):** Created by Admin. Defines the business domain (e.g., *Name Screening*).
2. **Model (Child):** Created by Model Owner under a Project. Represents specific regional or functional instances (e.g., *Name Screening - SG*, *Name Screening - MY*).

---

## 4. Compliance & Documentation
Every **Model** entity must contain a **Management Approval Section**:
* **Requirement:** Model Owners must upload a document (PDF/Image/Email) proving that the business management has authorized the model's use.
* **Validation:** This is a prerequisite for model activation.

---

## 5. Job Training & Monitoring
A **Job** represents a single training iteration of a specific Model. The system tracks the following technical metadata:

### A. Performance Metrics
* **Key Indicators:** F1 Score, Accuracy, AUC_ROC, Precision, Recall.

### B. Feature Statistics
* **Mean Values:** The arithmetic mean for every feature in the training set.
* **Missing Values:** The null/missing percentage for every feature.
* **Feature Importance:** Measured via **SHAP values**.
    * *UI Requirement:* Features must be sorted in descending order of importance (highest SHAP on top).

### C. Drift Detection Logic (The $6\sigma$ Rule)
The system monitors drift for Performance Metrics, Mean Values, and Missing Values.
* **Baseline:** Calculated using the **latest 6 approved Jobs**.
* **Trigger:** A "Drift Highlight in Red Color" (Alert) is triggered if a value deviates by more than **6 Standard Deviations** ($> 6\sigma$) from the baseline mean.

---

## 6. Approval Workflow Logic
The system enforces a "Four-Eyes" principle for any anomalous training results.

### Workflow States:
1. **Auto-Approval:** * If **No Drift** is detected, the Job is automatically moved to the `Approved` state.
2. **Manual Review (If Drift Highlighted):**
   * **Stage 1 (Model Owner):** Must review the drift, provide a text **Justification**, and "Approve" the result locally.
   * **Stage 2 (Model Approver):** Must perform a final review. The Job only reaches the `Approved` state if the Approver grants final consent.
3. **Rejection:**
   * If either the Model Owner or Model Approver "Rejects" the Job, it is marked as `Rejected` and cannot be used in production.

## Deploying To Vercel

This repo is now set up so it can run locally with `npm start` and deploy to Vercel with the same application logic.

### Local Run

```bash
npm start
```

The app will be available at `http://127.0.0.1:3000`.

### Vercel Deploy

1. Push this repository to GitHub.
2. Log in to Vercel and click `Add New...` -> `Project`.
3. Import the GitHub repository.
4. For the project settings:
   * Framework Preset: `Other`
   * Build Command: leave empty
   * Output Directory: leave empty
5. Click `Deploy`.

### Notes

* Static files are served from `public/`.
* API routes are handled by `api/[...path].js` on Vercel.
* The app currently stores its data in memory, so Vercel deployments will reset to seed data on cold starts or redeploys.
