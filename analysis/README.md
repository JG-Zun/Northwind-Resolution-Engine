# Northwind data analysis

The source analysis is [CGI Challenge/Analysis.py](../CGI%20Challenge/Analysis.py); its CSV inputs are in the same directory. It groups meter and complaint records by region, and identifies the SYS-01 regions from the system inventory notes before comparing them with modernized regions. It prints the backlog simulation and commercial value case; the Spring API also calculates the core regional insight from these CSVs at startup and exposes it at `GET /api/analysis/insight`.

The data-driven hypothesis is that SYS-01's Barrowdale and Dunmoor footprint is associated with substantially higher estimated-read rates, no smart-meter penetration, more billing exceptions, and billing complaints. This is an association, not proof of causation. Open backlog is defined by a blank `date_closed` field, not by `status`; frontend views use the same definition.
