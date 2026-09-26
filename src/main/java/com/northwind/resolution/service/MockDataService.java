package com.northwind.resolution.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;

/** Loads fixtures once at startup; each response gets a copy so callers cannot mutate shared data. */
@Service
public class MockDataService {
    private final ObjectMapper mapper;
    private final JsonNode backlog;
    private final JsonNode unifiedView;
    private final JsonNode triageResponse;

    public MockDataService(ObjectMapper mapper) {
        this.mapper = mapper;
        this.backlog = load("mock-data/backlog.json");
        this.unifiedView = load("mock-data/unified-view.json");
        this.triageResponse = load("mock-data/triage-response.json");
    }

    public JsonNode getBacklog() {
        return backlog.deepCopy();
    }

    /** The fixture represents one known account; unknown IDs are handled as 404 by the controller. */
    public JsonNode getUnifiedView(String accountId) {
        if (!unifiedView.path("account_id").asText().equalsIgnoreCase(accountId)) {
            return null;
        }
        return unifiedView.deepCopy();
    }

    /** The mock AI result is deterministic, with the route ID attached to each response. */
    public JsonNode triage(String complaintId, JsonNode complaintPayload) {
        JsonNode response = triageResponse.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) response).put("complaint_id", complaintId);
        return response;
    }

    private JsonNode load(String path) {
        try (var input = new ClassPathResource(path).getInputStream()) {
            return mapper.readTree(input);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load mock fixture: " + path, exception);
        }
    }
}
