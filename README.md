# Northwind Resolution Engine

Hack the Hill III Northwind Utilities project. The React dashboard reads the six challenge CSVs directly from `frontend/public/data/`; the Spring Boot service ingests the source CSVs and provides a live, rule-based API. No upstream billing or CRM writes are performed, so triage dispositions are recommendations rather than claims of completed customer resolutions.

## Run locally

Requires JDK 21 and Maven 3.9+.

```sh
cd backend
mvn clean test
mvn spring-boot:run
```

The API listens on `http://localhost:8080` and accepts local frontend origins `localhost:3000` and `localhost:5173`. The default data path is `../CGI Challenge`; set `NORTHWIND_DATA_DIR` to override it.

## API

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/complaints/backlog` | Open complaints (`date_closed` blank), sorted by priority and SLA breach |
| GET | `/api/accounts/{id}/unified-view` | Complaint history and available regional metering context for a source `account_id` |
| POST | `/api/complaints/{id}/triage` | Rule-based disposition, recommended action, rationale, confidence and evidence |
| GET | `/api/analysis/insight` | Live SYS-01 regional comparison, region-month correlation and operating baseline |

Backlog items retain the mock API's key fields (`complaint_id`, `account_id`, `category`, `priority`, `priority_rank`, `sla_breached`, `region`, `status`, `created_at`, and `summary`) and include available source columns. Customer names and account-level billing/meter details are `null` when absent from the supplied datasets. Unified view IDs are the CSV's `account_id` values, such as `ACC-943644`; unknown IDs return HTTP 404.

The triage request accepts a JSON complaint payload and returns the route ID as `complaint_id`. Example payload: `{"account_id":"ACC-943644","category":"Billing - estimated read","priority":"P2","region":"Barrowdale"}`. P1, reopened, and regulator-referral cases are escalated; billing/metering cases in SYS-01 regions are routed to meter/bill validation; information-only cases are marked ready for a verified response, not auto-closed.

## Data finding and frontend contract

The analysis identifies Barrowdale and Dunmoor from the SYS-01 system notes. Their meter-read and complaint data are compared with the modernized regions; the region-month Pearson correlation is descriptive, not proof of causation. Open backlog consistently means a blank `date_closed` field.

The current frontend does not call HTTP API routes. `frontend/src/lib/data.js` downloads `northwind_complaints.csv`, `northwind_systems.csv`, `northwind_monthly_kpis.csv`, `northwind_meter_reads.csv`, `northwind_ai_pilot_2025.csv`, and `northwind_unit_costs.csv` from `frontend/public/data/`, parses header-based rows with dynamic typing, and passes `{ complaints, systems, kpis, meter, pilot, costs }` to the views. The Java routes preserve the existing mock API paths as a separate backend contract.

See [analysis/README.md](analysis/README.md) for the analysis source and interpretation notes.
