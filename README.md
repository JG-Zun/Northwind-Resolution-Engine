# Northwind Resolution Engine

Lightweight Spring Boot mock integration API for the Hack the Hill III Northwind Utilities agent desktop. The fixtures are deliberately static so the frontend can build against stable payloads while legacy-system analysis is underway.

## Run locally

Requires JDK 21 and Maven 3.9+.

```sh
mvn clean test
mvn spring-boot:run
```

The API listens on `http://localhost:8080`. Local frontend origins `localhost:3000` and `localhost:5173` are enabled for CORS.

## Routes

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/complaints/backlog` | Prioritized open-complaint array with SLA and region fields |
| GET | `/api/accounts/NW-1001/unified-view` | Customer, complaint history, metering, billing, and exception object |
| POST | `/api/complaints/{id}/triage` | Deterministic mock AI recommendation and confidence score |

The unified-view fixture currently supports account `NW-1001`; other account IDs return HTTP 404. The triage route accepts a JSON complaint payload, for example:

```sh
curl -X POST http://localhost:8080/api/complaints/CMP-20481/triage \
	-H 'Content-Type: application/json' \
	-d '{"account_id":"NW-1001","category":"Billing dispute","priority":"critical"}'
```

## Project layout

```text
src/main/java/com/northwind/resolution/
├── ResolutionEngineApplication.java
├── controller/ApiController.java       # HTTP routes and routing decisions
└── service/MockDataService.java        # Loads fixtures once; returns isolated copies
src/main/resources/
├── application.properties
└── mock-data/
		├── backlog.json
		├── unified-view.json
		└── triage-response.json
```

Replace `MockDataService` fixture lookups with legacy-system adapters as integrations become available; the HTTP contract remains unchanged.
