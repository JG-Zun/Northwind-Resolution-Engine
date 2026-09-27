package com.northwind.resolution.service;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

@Service
public class ResolutionService {
    private static final Map<String, Integer> PRIORITY_RANKS = Map.of("P1", 1, "P2", 2, "P3", 3);

    private final List<Map<String, String>> complaints;
    private final List<Map<String, String>> systems;
    private final List<Map<String, String>> meterReads;
    private final List<Map<String, String>> monthlyKpis;
    private final List<Map<String, String>> unitCosts;
    private final Set<String> legacyRegions;
    private final Path dataDirectory;

    public ResolutionService(@Value("${northwind.data-directory:../CGI Challenge}") String dataDirectory) {
        this.dataDirectory = Path.of(dataDirectory).toAbsolutePath().normalize();
        this.complaints = readCsv("northwind_complaints.csv");
        this.systems = readCsv("northwind_systems.csv");
        this.meterReads = readCsv("northwind_meter_reads.csv");
        this.monthlyKpis = readCsv("northwind_monthly_kpis.csv");
        this.unitCosts = readCsv("northwind_unit_costs.csv");
        this.legacyRegions = findLegacyRegions();
    }

    public List<Map<String, Object>> getBacklog() {
        return complaints.stream()
                .filter(this::isOpen)
                .sorted(Comparator
                        .comparingInt((Map<String, String> row) -> priorityRank(row.get("priority")))
                        .thenComparing((Map<String, String> row) -> !truthy(row.get("sla_breach")))
                        .thenComparing(row -> row.getOrDefault("date_opened", "")))
                .map(this::toBacklogDto)
                .toList();
    }

    public Map<String, Object> getUnifiedView(String accountId) {
        List<Map<String, String>> accountComplaints = complaints.stream()
                .filter(row -> equalsIgnoreCase(row.get("account_id"), accountId))
                .sorted(Comparator.comparing(row -> row.getOrDefault("date_opened", "")))
                .toList();
        if (accountComplaints.isEmpty()) {
            return null;
        }

        Map<String, Object> customer = new LinkedHashMap<>();
        customer.put("name", null);
        customer.put("service_address", null);
        customer.put("preferred_contact", null);
        customer.put("email", null);
        customer.put("phone", null);
        customer.put("account_status", "unknown");

        List<Map<String, Object>> history = accountComplaints.stream().map(row -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("complaint_id", row.get("complaint_id"));
            item.put("system", row.get("source_system"));
            item.put("category", row.get("category"));
            item.put("status", row.get("status"));
            item.put("priority", priorityLabel(row.get("priority")));
            item.put("sla_breached", truthy(row.get("sla_breach")));
            item.put("created_at", row.get("date_opened"));
            item.put("summary", row.get("category"));
            return item;
        }).toList();

        Map<String, String> latest = accountComplaints.get(accountComplaints.size() - 1);
        String region = latest.get("region");
        Map<String, String> regionalMeter = latestMeterRead(region);
        Map<String, Object> meteringAndBilling = new LinkedHashMap<>();
        meteringAndBilling.put("meter", null);
        meteringAndBilling.put("billing_account", null);
        meteringAndBilling.put("exceptions", List.of());
        meteringAndBilling.put("regional_context", regionalContext(region, regionalMeter));

        Set<String> sourceSystems = accountComplaints.stream()
                .map(row -> row.get("source_system"))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(TreeSet::new));
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("mock", false);
        metadata.put("source_systems", sourceSystems);
        metadata.put("assembled_at", Instant.now().toString());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("account_id", accountId);
        result.put("customer", customer);
        result.put("service_complaint_history", history);
        result.put("metering_and_billing", meteringAndBilling);
        result.put("integration_metadata", metadata);
        return result;
    }

    public Map<String, Object> triage(String complaintId, Map<String, Object> suppliedPayload) {
        Map<String, String> source = complaints.stream()
                .filter(row -> equalsIgnoreCase(row.get("complaint_id"), complaintId))
                .findFirst()
                .orElse(null);
        Map<String, Object> payload = suppliedPayload == null ? Map.of() : suppliedPayload;
        if (source == null && payload.isEmpty()) {
            return null;
        }

        String category = source == null
                ? string(payload.get("category"))
                : source.getOrDefault("category", "");
        String region = source == null
                ? string(payload.get("region"))
                : source.getOrDefault("region", "");
        String priority = source == null
                ? string(payload.get("priority"))
                : source.getOrDefault("priority", "");
        String channel = source == null
                ? string(payload.get("channel"))
                : source.getOrDefault("channel", "");
        boolean reopened = source == null
                ? truthy(payload.get("reopened"))
                : truthy(source.get("reopened"));
        boolean infoOnly = source == null
                ? truthy(payload.get("resolvable_by_information_only"))
                : truthy(source.get("resolvable_by_information_only"));
        boolean highRisk = isP1(priority) || reopened || channel.toLowerCase(Locale.ROOT).contains("regulator");
        boolean legacy = legacyRegions.stream().anyMatch(value -> value.equalsIgnoreCase(region));
        String normalizedCategory = category.toLowerCase(Locale.ROOT);

        String action;
        String rationale;
        double confidence;
        String disposition;
        if (highRisk) {
            action = "Escalate to a senior complaints agent; review the full case history and confirm any regulator or repeat-contact commitments before responding.";
            rationale = "The case is high risk because it is P1, reopened, or from a regulator referral channel; automated closure is disabled.";
            confidence = 0.99;
            disposition = "agent_escalation";
        } else if (legacy && (normalizedCategory.contains("bill") || normalizedCategory.contains("meter"))) {
            action = "Validate the latest actual meter read in MeterHub (SYS-06), reconcile it with the Aurora Billing (SYS-01) estimate, then correct and re-issue only the verified bill.";
            rationale = "The complaint concerns billing or metering in a SYS-01 region. The regional data shows elevated estimated reads and no smart-meter penetration, so verify the source reading before changing a bill.";
            confidence = 0.94;
            disposition = "meter_and_billing_review";
        } else if (infoOnly) {
            action = "Prepare an information-only response using verified case records, cite the evidence, and confirm the customer understands; do not alter a bill or mark the case resolved until the response is recorded.";
            rationale = "The source record marks this case as resolvable by information only and it did not trigger the high-risk escalation rules.";
            confidence = 0.86;
            disposition = "information_response_ready";
        } else if (normalizedCategory.contains("bill") || normalizedCategory.contains("meter")) {
            action = "Compare the complaint with the recorded meter and billing evidence; route any unexplained variance to the billing operations queue for an authorized correction.";
            rationale = "The case is billing- or metering-related, but the supplied regional data does not place it in the identified SYS-01 risk footprint.";
            confidence = 0.82;
            disposition = "billing_agent_review";
        } else if (normalizedCategory.contains("payment")) {
            action = "Review the existing payment-plan terms and due date, then offer an eligible amendment through the approved payment workflow.";
            rationale = "Payment-plan changes require account eligibility checks that are not present in the complaint extract.";
            confidence = 0.80;
            disposition = "payment_agent_review";
        } else {
            action = "Review the complaint history and relevant service record, then provide a customer update or assign the required operational follow-up.";
            rationale = "The source data does not contain enough verified detail to safely complete this case automatically.";
            confidence = 0.72;
            disposition = "agent_review";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("complaint_id", complaintId);
        result.put("recommended_action", action);
        result.put("confidence_score", confidence);
        result.put("rationale", rationale);
        result.put("mock", false);
        result.put("disposition", disposition);
        result.put("automated_resolution", false);
        result.put("source", source == null ? "request_payload" : "northwind_complaints.csv");
        result.put("evidence", Map.of(
                "category", category,
                "region", region,
                "legacy_sys_01_region", legacy,
                "priority", priority,
                "reopened", reopened,
                "resolvable_by_information_only", infoOnly));
        return result;
    }

    public Map<String, Object> getAnalysisInsight() {
        Map<String, List<Map<String, String>>> meterByRegion = meterReads.stream()
                .collect(Collectors.groupingBy(row -> row.getOrDefault("region", "")));
        Map<String, List<Map<String, String>>> complaintsByRegion = complaints.stream()
                .collect(Collectors.groupingBy(row -> row.getOrDefault("region", "")));

        Map<String, Object> legacy = aggregateRegions(legacyRegions, meterByRegion, complaintsByRegion);
        Set<String> modernRegions = meterByRegion.keySet().stream()
                .filter(region -> !legacyRegions.contains(region))
                .collect(Collectors.toCollection(TreeSet::new));
        Map<String, Object> modern = aggregateRegions(modernRegions, meterByRegion, complaintsByRegion);

        Map<String, Integer> complaintsByRegionMonth = new LinkedHashMap<>();
        for (Map<String, String> row : complaints) {
            String date = row.getOrDefault("date_opened", "");
            if (date.length() >= 7) {
                String key = row.getOrDefault("region", "") + "|" + date.substring(0, 7);
                complaintsByRegionMonth.merge(key, 1, Integer::sum);
            }
        }
        List<double[]> correlationPoints = new ArrayList<>();
        for (Map<String, String> meter : meterReads) {
            String key = meter.getOrDefault("region", "") + "|" + meter.getOrDefault("month", "");
            Double estimatedRate = decimal(meter.get("estimated_read_rate"));
            Double accounts = decimal(meter.get("accounts"));
            if (estimatedRate != null && accounts != null && accounts > 0) {
                double complaintsPerThousand = complaintsByRegionMonth.getOrDefault(key, 0) * 1000.0 / accounts;
                correlationPoints.add(new double[]{estimatedRate, complaintsPerThousand});
            }
        }
        Double pearson = pearson(correlationPoints);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("open_backlog", getBacklog().size());
        result.put("backlog_definition", "complaint rows with blank date_closed");
        result.put("legacy_system", "SYS-01");
        result.put("sys_01_regions", legacyRegions);
        result.put("sys_01_region_summary", legacy);
        result.put("modernized_region_summary", modern);
        result.put("region_month_correlation", Map.of(
                "x", "estimated_read_rate",
                "y", "complaints_per_1000_accounts",
                "pearson_r", pearson == null ? "insufficient_variance" : round(pearson, 3),
                "n", correlationPoints.size()));
        result.put("interpretation", "SYS-01 regions have a materially higher estimated-read burden and no smart-meter penetration; compare their billing complaint and exception totals with the modernized regions. The region-month correlation is descriptive and does not establish causation.");
        result.put("data_sources", List.of(
                "northwind_complaints.csv",
                "northwind_meter_reads.csv",
                "northwind_systems.csv",
                "northwind_monthly_kpis.csv",
                "northwind_unit_costs.csv"));
        result.put("last_six_month_operating_baseline", operatingBaseline());
        return result;
    }

    private Map<String, Object> toBacklogDto(Map<String, String> row) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("complaint_id", row.get("complaint_id"));
        dto.put("account_id", row.get("account_id"));
        dto.put("customer_name", null);
        dto.put("category", row.get("category"));
        dto.put("priority", priorityLabel(row.get("priority")));
        dto.put("priority_rank", priorityRank(row.get("priority")));
        dto.put("sla_breached", truthy(row.get("sla_breach")));
        dto.put("region", row.get("region"));
        dto.put("status", row.getOrDefault("status", "Open"));
        dto.put("created_at", row.get("date_opened"));
        dto.put("summary", row.get("category"));
        dto.put("channel", row.get("channel"));
        dto.put("source_system", row.get("source_system"));
        dto.put("transferred_between_systems", truthy(row.get("transferred_between_systems")));
        dto.put("sla_days", integer(row.get("sla_days")));
        dto.put("days_to_close", integer(row.get("days_to_close")));
        dto.put("sla_breach", truthy(row.get("sla_breach")));
        dto.put("reopened", truthy(row.get("reopened")));
        dto.put("resolution_action", row.get("resolution_action"));
        dto.put("resolvable_by_information_only", truthy(row.get("resolvable_by_information_only")));
        dto.put("bill_correction_value", decimal(row.get("bill_correction_value")));
        dto.put("date_opened", row.get("date_opened"));
        dto.put("date_closed", row.get("date_closed"));
        return dto;
    }

    private Map<String, Object> aggregateRegions(
            Set<String> regions,
            Map<String, List<Map<String, String>>> metersByRegion,
            Map<String, List<Map<String, String>>> complaintsByRegion) {
        List<Map<String, String>> selectedMeters = regions.stream()
                .flatMap(region -> metersByRegion.getOrDefault(region, List.of()).stream())
                .toList();
        List<Map<String, String>> selectedComplaints = regions.stream()
                .flatMap(region -> complaintsByRegion.getOrDefault(region, List.of()).stream())
                .toList();
        long billingCount = selectedComplaints.stream()
                .filter(row -> row.getOrDefault("category", "").toLowerCase(Locale.ROOT).contains("bill"))
                .count();
        double corrections = selectedComplaints.stream()
                .mapToDouble(row -> valueOrZero(decimal(row.get("bill_correction_value"))))
                .sum();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("regions", regions);
        result.put("region_count", regions.size());
        result.put("average_estimated_read_rate", average(selectedMeters, row -> valueOrZero(decimal(row.get("estimated_read_rate")))));
        result.put("average_smart_meter_penetration", average(selectedMeters, row -> valueOrZero(decimal(row.get("smart_meter_penetration")))));
        result.put("average_monthly_billing_exceptions", average(selectedMeters, row -> valueOrZero(decimal(row.get("billing_exceptions_raised")))));
        result.put("billing_complaints", billingCount);
        result.put("bill_correction_value", round(corrections, 2));
        result.put("complaint_rows", selectedComplaints.size());
        return result;
    }

    private Map<String, Object> operatingBaseline() {
        List<Map<String, String>> tail = monthlyKpis.stream()
                .skip(Math.max(0, monthlyKpis.size() - 6L))
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("months", tail.size());
        result.put("average_complaints_opened", average(tail, row -> valueOrZero(decimal(row.get("complaints_opened")))));
        result.put("average_complaints_closed", average(tail, row -> valueOrZero(decimal(row.get("complaints_closed")))));
        result.put("complaint_handling_cost", unitCosts.stream()
                .filter(row -> row.getOrDefault("item", "").toLowerCase(Locale.ROOT).contains("complaint handled end to end (average)"))
                .map(row -> decimal(row.get("unit_cost"))).filter(Objects::nonNull).findFirst().orElse(null));
        return result;
    }

    private Map<String, Object> regionalContext(String region, Map<String, String> meter) {
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("region", region);
        context.put("legacy_sys_01_region", legacyRegions.stream().anyMatch(value -> value.equalsIgnoreCase(region)));
        if (meter != null) {
            context.put("month", meter.get("month"));
            context.put("estimated_read_rate", decimal(meter.get("estimated_read_rate")));
            context.put("smart_meter_penetration", decimal(meter.get("smart_meter_penetration")));
            context.put("billing_exceptions_raised", integer(meter.get("billing_exceptions_raised")));
            context.put("systems_serving_region", meter.get("systems_serving_region"));
        }
        return context;
    }

    private Map<String, String> latestMeterRead(String region) {
        return meterReads.stream()
                .filter(row -> equalsIgnoreCase(row.get("region"), region))
                .max(Comparator.comparing(row -> row.getOrDefault("month", "")))
                .orElse(null);
    }

    private Set<String> findLegacyRegions() {
        String notes = systems.stream()
                .filter(row -> "SYS-01".equalsIgnoreCase(row.get("system_id")))
                .map(row -> row.getOrDefault("notes", ""))
                .findFirst()
                .orElse("");
        return meterReads.stream()
                .map(row -> row.get("region"))
                .filter(Objects::nonNull)
                .filter(region -> notes.toLowerCase(Locale.ROOT).contains(region.toLowerCase(Locale.ROOT)))
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private boolean isOpen(Map<String, String> row) {
        return row.getOrDefault("date_closed", "").isBlank();
    }

    private List<Map<String, String>> readCsv(String fileName) {
        Path file = dataDirectory.resolve(fileName).normalize();
        if (!Files.isRegularFile(file)) {
            throw new IllegalStateException("Required Northwind CSV not found: " + file);
        }
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .build();
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8);
             CSVParser parser = format.parse(reader)) {
            List<Map<String, String>> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                Map<String, String> row = new LinkedHashMap<>();
                for (String header : parser.getHeaderNames()) {
                    String value = record.isMapped(header) ? record.get(header) : "";
                    row.put(header, value == null ? "" : value.trim());
                }
                rows.add(row);
            }
            return List.copyOf(rows);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read Northwind CSV: " + file, exception);
        }
    }

    private static boolean truthy(String value) {
        return value != null && Set.of("true", "1", "yes", "y").contains(value.trim().toLowerCase(Locale.ROOT));
    }

    private static boolean truthy(Object value) {
        return value instanceof Boolean bool ? bool
                : value instanceof Number number ? number.intValue() != 0
                : truthy(value == null ? null : value.toString());
    }

    private static boolean isP1(String priority) {
        return priority != null && (priority.equalsIgnoreCase("P1") || priority.equalsIgnoreCase("critical") || priority.equalsIgnoreCase("urgent"));
    }

    private static int priorityRank(String priority) {
        String value = priority == null ? "" : priority.trim().toUpperCase(Locale.ROOT);
        if (PRIORITY_RANKS.containsKey(value)) {
            return PRIORITY_RANKS.get(value);
        }
        return switch (value) {
            case "CRITICAL", "URGENT" -> 1;
            case "HIGH" -> 2;
            case "NORMAL" -> 3;
            case "LOW" -> 4;
            default -> 5;
        };
    }

    private static String priorityLabel(String priority) {
        return switch (priorityRank(priority)) {
            case 1 -> "critical";
            case 2 -> "high";
            case 3 -> "normal";
            case 4 -> "low";
            default -> priority == null || priority.isBlank() ? "unknown" : priority.toLowerCase(Locale.ROOT);
        };
    }

    private static Integer integer(String value) {
        try {
            return value == null || value.isBlank() ? null : Integer.valueOf(value.trim());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Double decimal(String value) {
        try {
            return value == null || value.isBlank() ? null : new BigDecimal(value.trim()).doubleValue();
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static double valueOrZero(Double value) {
        return value == null ? 0.0 : value;
    }

    private static double average(List<Map<String, String>> rows, ToDoubleFunction<Map<String, String>> selector) {
        return rows.isEmpty() ? 0.0 : rows.stream().mapToDouble(selector).average().orElse(0.0);
    }

    private static Double pearson(List<double[]> points) {
        if (points.size() < 3) {
            return null;
        }
        double meanX = points.stream().mapToDouble(point -> point[0]).average().orElse(0.0);
        double meanY = points.stream().mapToDouble(point -> point[1]).average().orElse(0.0);
        double covariance = 0.0;
        double varianceX = 0.0;
        double varianceY = 0.0;
        for (double[] point : points) {
            double dx = point[0] - meanX;
            double dy = point[1] - meanY;
            covariance += dx * dy;
            varianceX += dx * dx;
            varianceY += dy * dy;
        }
        double denominator = Math.sqrt(varianceX * varianceY);
        return denominator == 0.0 ? null : covariance / denominator;
    }

    private static double round(double value, int places) {
        double factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }

    private static boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private static String string(Object value) {
        return value == null ? "" : value.toString();
    }
}
