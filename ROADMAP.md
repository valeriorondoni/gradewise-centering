# GradeWise — Implementation Roadmap (University Prototype)

A practical, phased roadmap to build the **7-stage Centralised Card Management** workflow in the existing React + Flask codebase.

> **Scope rule:** The Python CV engine (`centering.py` + `wear.py` via `webapp.py`) is the **only real analysis backend**. Card recognition, market prices, grader/carrier APIs, and marketplace listings use **mock data** + local JSON/state persistence so the full end-to-end lifecycle can be demonstrated reliably.

---

## Core Architecture: One Continuous Card Record

Create a single `CardRecord` data model (stored in `localStorage` or a simple JSON file via `webapp.py`) that follows a card across all 7 stages:

- **Identity**: `id`, `name`, `set`, `number`, `language`, `variant`, `purchaseCost`, `photos`
- **Estimate (Real Python Engine)**: `runId`, `ceiling`, `centeringCap`, `wearCap`, `overlayImages`
- **Financials & Decision (Mock)**: `rawValue`, `gradedValues` (PSA/BGS/CGC), `fees`, `netRoi`, `decision`
- **Submission & Logistics (Mock)**: `grader`, `serviceTier`, `trackingCode`, `timeline[]`
- **Reconciliation & Sale (Mock)**: `officialGrade`, `certNumber`, `listedChannels[]`, `salePrice`, `realisedProfit`

---

## Phase 1 — Inventory & Card Import (Stage 1)
- **What we can build**:
  - Add a **My Cards / Inventory** dashboard view alongside the existing Landing and Assess views.
  - After uploading front/back photos, auto-suggest card identity (`name`, `set`, `number`, `language`) from a mock catalog lookup and let the user confirm/edit + enter `purchaseCost`.
  - Save each assessed card as a persistent `CardRecord` with its `runId` and photos.

## Phase 2 — Financial Decision & Grader Comparison (Stages 2–3)
- **What we can build**:
  - Map the Python engine's `ceiling` (e.g. PSA 8–9) to mock European market prices (`rawValue` vs. graded values).
  - Calculate **Net ROI** = `Graded Value - Raw Value - Grading Fee - Shipping/Insurance - Selling Fee`, compared against the user's minimum return target.
  - Display a clear **Submit vs. Keep Raw** recommendation and a grader selector (**PSA / BGS / CGC** mock tiers) to approve submission.

## Phase 3 — Submission Prep, Labels & Tracking (Stages 4–5)
- **What we can build**:
  - Generate a printable **Submission Summary & Packing Checklist** (modal/print view) with mock carrier label & tracking number.
  - Add a **5-step Card Timeline** (`Prepared → Shipped → Received by Grader → Grading → Returned`) with a **"Simulate Next Update"** button for live demoing of status changes and notifications.
  - Support batching multiple `CardRecord`s into a single shared submission.

## Phase 4 — Reconcile & Multi-Channel Resale (Stages 6–7)
- **What we can build**:
  - **Receive & Reconcile** form: enter/import mock official grade & cert number, compare *Estimated vs. Official Grade*, and update total committed cost.
  - **Mock Marketplace Publisher**: one-click publish to simulated channels (**eBay**, **Cardmarket**, **CardTrader**). Marking a card as *Sold* on one channel auto-delists the others and computes final **Realised Profit**.

---

## Suggested Build Order
1. **Shared `CardRecord` store + Inventory Dashboard** (connects the existing Python assessment to persistent card records).
2. **Mock Pricing + ROI & Grader Decision panel** (completes the core GradeWise USP).
3. **Submission Prep + Interactive Tracking Timeline** (demonstrates logistics without external APIs).
4. **Reconciliation + Mock Marketplace Listing & Profit Tracker** (closes the loop through resale).
