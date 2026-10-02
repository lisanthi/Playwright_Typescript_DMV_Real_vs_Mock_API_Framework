# OpenQueue DMV Service Virtualization Test Plan

## Purpose

Run the same six customer flows in two modes and compare the results:

- **Mock API:** Playwright intercepts application API requests and returns controlled responses. These tests verify UI behavior and request construction without depending on backend availability or persistent data.
- **Real API:** The browser uses the test backend. These tests verify the UI, API, and test data together.

The two modes are complementary, not interchangeable. A passing mock test does not establish that a real endpoint or database works. Keep scenario steps and user-visible assertions aligned where the modes cover the same behavior, and report each mode separately.

## Environment and Data Rules

- Run against a dedicated non-production application and API environment. Do not point real-API tests at production.
- Configure the application URL and, if needed, API URL through the Playwright test environment. The current Playwright config does not set a `baseURL`; configure it before implementing these tests.
- Use the existing application request paths and response schemas discovered from the running application. Do not assume endpoint paths or payload fields from this plan.
- In mock mode, intercept only the application's API requests. Provide every response the page needs, and fail or record unexpected API requests so tests do not silently reach a real backend.
- Mock tests should not create backend records. Reset route handlers and browser state for every test.
- Real-API tests need isolated data: create the required ticket through an approved test setup mechanism, capture its identifier, and clean it up or reset the test environment afterward. The repository currently has no documented seed/reset endpoint; establish one before relying on persistent shared data.
- Make each test independent and safe to run in parallel. Use unique real ticket data per test, and avoid shared mutable fixtures.
- Keep reusable branch/service combinations in a test fixture dataset when exercising multiple combinations; use only pairs confirmed as supported by the application.
- Keep mock and real-API results separately identifiable in reports, for example with separate Playwright projects or suite names.

## Scenarios

### 1. Join a queue with a selected branch and service

**Mock API:** Return a stable branch list and service options. On submission, return a successful ticket response with deterministic ticket, queue position, and wait data. Verify the UI displays the returned data and that the create request contains the selected branch and service. Add a separate mocked server-error case and verify the error is presented without a false success state.

**Real API:** Load the available branches/services from the test backend, submit one queue request, and verify the resulting ticket through the customer UI or a supported API lookup. Clean up the created ticket or reset the isolated test data.

**Compare:** Branch/service selection, submitted values, success presentation, and error presentation. The mock proves the UI's handling of these responses; only the real run proves ticket persistence and backend behavior.

**Known risk:** Exploration observed API Error 500 during ticket creation. Record this as a real-API failure and investigate it; do not make the mock success response stand in for a backend fix.

### 6. Create tickets for data-driven branch/service combinations

**Input data:** Use `test-data/branch-service-combinations.json`. Each row should identify a case, a supported branch, a service available at that branch, and any expected selection details the UI exposes. Populate identifiers and values from the application's actual branch/service data; do not assume every service is valid at every branch. Keep unsupported combinations in a separate negative dataset only if the product defines their expected behavior.

**Mock API:** For each row, return branch and service responses consistent with that pair, select the row's branch and service, and submit once. Return deterministic successful ticket data. Verify the submitted identifiers match the row and the resulting ticket UI reflects the selected combination. Reset interception and browser state between rows so one case cannot affect another.

**Real API:** For each row, load the actual branch/service choices, verify the pair is offered, submit a ticket, and confirm the created ticket is associated with the expected branch and service. Use unique records per row and clean them up or reset the isolated test environment afterward. If a pair listed in the fixture is no longer offered, report it as a data/contract mismatch rather than silently skipping it.

**Compare:** Record pass/fail per data row, selected and submitted branch/service, and created ticket association. Mock mode checks handling across the dataset; real mode checks actual availability and persistence. The known ticket-creation HTTP 500 can block real rows and must remain visible in results.

### 2. Prevent ticket requests when required selections are missing

**Mock API:** Return branch and service data needed to exercise the form. Verify submission is unavailable until required choices are selected, changing the branch cannot submit a stale invalid service, and no create-ticket request is sent for invalid form state.

**Real API:** Repeat the same UI interaction against the test backend and verify no ticket is created for incomplete or invalid selections. Confirm with a supported test API or a before/after test-data check where possible.

**Compare:** The disabled/enabled state, selection-reset behavior, and whether a create request or ticket record exists. Most validation coverage is client-side, so mock and real behavior should be nearly identical here.

### 3. Look up an existing ticket and review its queue status

**Mock API:** Return a fixed status response for a known test ticket number, including branch, service, queue state, position, and estimated wait when supported by the actual response schema. Verify the page shows those exact values.

**Real API:** Create or seed a waiting ticket in the test backend, look it up through the UI, and verify the displayed values match the created fixture. Clean up or reset the fixture after the test.

**Compare:** Displayed ticket data and handling of optional status fields. The mock validates rendering; the real run validates lookup, persistence, and response mapping together.

### 4. Handle a ticket number that does not exist

**Mock API:** Return the same not-found status and response shape observed from the application API (exploration saw HTTP 404). Verify a clear not-found message appears, no queue details appear, and the form remains usable.

**Real API:** Generate a unique ticket number that is guaranteed not to exist in the isolated test environment, query it, and verify the backend returns not-found and the UI handles it correctly.

**Compare:** Error message, absence of stale ticket details, and ability to retry. The mock checks the UI's 404 handling; the real run checks that the backend produces the expected not-found result.

### 5. Control automatic status refresh and continue manual lookup

**Mock API:** Return a stable status response and record each status request. Verify the default refresh setting, that disabling it prevents later automatic requests, that manual lookup still sends a request, and that re-enabling it resumes polling. Control browser time or use a short test-only polling interval if the application supports one; do not make the test depend on uncontrolled real-time waits.

**Real API:** Use a seeded ticket and verify the initial lookup, manual lookup, and automatic refresh against the test backend. Observe the configured interval (10 seconds per the current UI) and verify the ticket input remains intact. Keep this test independent of the mock route setup.

**Compare:** Polling behavior and request count/timing. Mock mode isolates timer and UI behavior; real mode confirms the same behavior works with live API responses.

## Result Matrix

Record one result for each scenario and mode. For scenario 6, record a result for every input-data row:

| Scenario | Mock API result | Real API result | Notes |
| --- | --- | --- | --- |
| Join queue | UI/request behavior | Ticket creation and persistence | Track the observed HTTP 500 separately |
| Required selections | Client validation and request suppression | Validation plus no invalid record | |
| Existing ticket status | Status rendering | Real ticket lookup and data mapping | |
| Unknown ticket | 404 UI handling | Backend not-found behavior and UI handling | |
| Auto-refresh | Timer and polling UI behavior | Polling against test backend | |
| Branch/service combinations | UI/request behavior per fixture row | Availability and ticket association per row | Record each data row separately |

## Exit Criteria

- All six mock scenarios pass without unexpected network access or persistent data changes.
- Every branch/service fixture row has an explicit result in both modes; no row is silently skipped.
- Real-API outcomes are reported independently; any failed endpoint is visible and not replaced by a mocked pass.
- Real tests use isolated, repeatable fixtures and leave no shared test data behind (or run against a resettable dedicated environment).
- Differences between mock and real results are investigated as possible backend, response-contract, or test-fixture issues.