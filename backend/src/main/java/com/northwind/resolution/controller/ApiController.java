package com.northwind.resolution.controller;

import com.northwind.resolution.service.ResolutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:5173"})
public class ApiController {
    private final ResolutionService resolutionService;

    public ApiController(ResolutionService resolutionService) {
        this.resolutionService = resolutionService;
    }

    @GetMapping("/complaints/backlog")
    public List<Map<String, Object>> getBacklog() {
        return resolutionService.getBacklog();
    }

    @GetMapping("/accounts/{id}/unified-view")
    public ResponseEntity<Map<String, Object>> getUnifiedView(@PathVariable String id) {
        Map<String, Object> view = resolutionService.getUnifiedView(id);
        return view == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(view);
    }

    @PostMapping("/complaints/{id}/triage")
    public ResponseEntity<Map<String, Object>> triage(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> complaintPayload) {
        Map<String, Object> result = resolutionService.triage(id, complaintPayload);
        return result == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(result);
    }

    @GetMapping("/analysis/insight")
    public Map<String, Object> getAnalysisInsight() {
        return resolutionService.getAnalysisInsight();
    }
}
