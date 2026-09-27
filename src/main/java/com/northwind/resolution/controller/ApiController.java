package com.northwind.resolution.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.northwind.resolution.service.MockDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class ApiController {
    private final MockDataService mockData;

    public ApiController(MockDataService mockData) {
        this.mockData = mockData;
    }

    @GetMapping("/complaints/backlog")
    public JsonNode getBacklog() {
        return mockData.getBacklog();
    }

    @GetMapping("/accounts/{id}/unified-view")
    public ResponseEntity<JsonNode> getUnifiedView(@PathVariable String id) {
        // Resolve only the seeded account fixture; unknown IDs return a conventional 404.
        JsonNode view = mockData.getUnifiedView(id);
        return view == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(view);
    }

    @PostMapping("/complaints/{id}/triage")
    public JsonNode triage(
            @PathVariable String id,
            @RequestBody JsonNode complaintPayload) {
        // Keep the mock AI adapter behind this route so it can be replaced without frontend changes.
        return mockData.triage(id, complaintPayload);
    }
}
