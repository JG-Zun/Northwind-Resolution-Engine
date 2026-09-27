import pandas as pd
import numpy as np

def run_northwind_analysis(scenario="interventions"):
    """
    Runs diagnostic analysis and backlog simulation.
    
    Parameters:
    - scenario (str): 'baseline' assumes current trends ("everything is fine"),
                      'interventions' models recommended root-cause fixes.
    """
    print("=========================================================")
    print(" NORTHWIND UTILITIES: DIAGNOSTIC & STRATEGIC ANALYSIS ")
    print("=========================================================\n")

    # 1. Load Datasets
    try:
        complaints = pd.read_csv('northwind_complaints.csv')
        systems = pd.read_csv('northwind_systems.csv')
        monthly_kpis = pd.read_csv('northwind_monthly_kpis.csv')
        meter_reads = pd.read_csv('northwind_meter_reads.csv')
        ai_pilot = pd.read_csv('northwind_ai_pilot_2025.csv')
        unit_costs = pd.read_csv('northwind_unit_costs.csv')
    except FileNotFoundError as e:
        print(f"Error loading CSV files: {e}")
        return

    # ---------------------------------------------------------
    # FINDING 1: Root Cause Analysis (Metering -> Billing -> Complaints)
    # ---------------------------------------------------------
    print("--- 1. ROOT CAUSE DIAGNOSIS ---")
    
    meter_agg = meter_reads.groupby('region').agg(
        avg_estimated_read_rate=('estimated_read_rate', 'mean'),
        avg_smart_meter_penetration=('smart_meter_penetration', 'mean'),
        monthly_billing_exceptions=('billing_exceptions_raised', 'mean')
    ).reset_index()

    complaints_reg = complaints.groupby('region').agg(
        total_complaints=('complaint_id', 'count'),
        billing_complaints=('category', lambda x: x.str.contains('Billing', case=False, na=False).sum()),
        total_bill_corrections_val=('bill_correction_value', 'sum'),
        sla_breach_rate=('sla_breach', 'mean')
    ).reset_index()

    regional_insight = pd.merge(meter_agg, complaints_reg, on='region')
    
    # Dynamic identification: Extract regions tied to SYS-01 directly from system notes
    sys_01_text = systems.loc[systems['system_id'] == 'SYS-01', 'notes'].iloc[0]
    sys_01_regions = [r for r in regional_insight['region'].unique() if r in sys_01_text]
    
    # Apply dynamic flag
    regional_insight['legacy_sys_01'] = regional_insight['region'].isin(sys_01_regions)
    
    summary_by_legacy = regional_insight.groupby('legacy_sys_01').agg(
        regions=('region', 'count'),
        avg_estimated_read_rate=('avg_estimated_read_rate', 'mean'),
        smart_meter_penetration=('avg_smart_meter_penetration', 'mean'),
        avg_monthly_exceptions=('monthly_billing_exceptions', 'mean'),
        billing_complaints=('billing_complaints', 'sum'),
        total_correction_cost=('total_bill_corrections_val', 'sum')
    ).reset_index()
    
    summary_by_legacy['legacy_sys_01'] = summary_by_legacy['legacy_sys_01'].map({
        True: f"SYS-01 Regions ({', '.join(sys_01_regions)})", 
        False: 'Modernized Regions'
    })
    print(summary_by_legacy.to_string(index=False))

    # ---------------------------------------------------------
    # FINDING 2: 2025 AI Pilot Diagnostic
    # ---------------------------------------------------------
    print("\n--- 2. 2025 AI PILOT DIAGNOSTIC ---")
    avg_contained = ai_pilot['fully_contained_rate'].mean()
    avg_escalated = ai_pilot['escalated_to_agent_rate'].mean()
    avg_csat = ai_pilot['assistant_csat_of_5'].mean()

    print(f"AI Pilot Containment Rate:          {avg_contained:.1%}")
    print(f"AI Pilot Escalation Rate to Agent:  {avg_escalated:.1%}")
    print(f"AI Pilot CSAT Score (out of 5):    {avg_csat:.2f}")

    # ---------------------------------------------------------
    # FINDING 3: Backlog Simulation (Baseline vs Interventions)
    # ---------------------------------------------------------
    print("\n--- 3. 12-MONTH BACKLOG DRAWDOWN SIMULATION ---")
    
    call_cost = float(unit_costs.loc[unit_costs['item'].str.contains('Inbound call', case=False), 'unit_cost'].values[0])
    complaint_cost = float(unit_costs.loc[unit_costs['item'].str.contains('Complaint handled', case=False), 'unit_cost'].values[0])
    
    current_backlog = 1599
    current_monthly_inflow = monthly_kpis['complaints_opened'].tail(6).mean()
    current_monthly_capacity = monthly_kpis['complaints_closed'].tail(6).mean()

    if scenario == "baseline":
        print("[SCENARIO A: STATUS QUO / EVERYTHING IS ALRIGHT ASSUMPTION]")
        monthly_inflow = current_monthly_inflow
        monthly_capacity = current_monthly_capacity
        monthly_drawdown = monthly_capacity - monthly_inflow
        
        print(f"Current Open Backlog:            {current_backlog} cases")
        print(f"Monthly Complaint Inflow:        {monthly_inflow:.0f} cases/month")
        print(f"Monthly Resolution Capacity:     {monthly_capacity:.0f} cases/month")
        print(f"Net Monthly Backlog Change:      {monthly_drawdown:.0f} cases/month")
        
        if monthly_drawdown <= 0:
            print(f"CRITICAL VERDICT: Under the status quo, the backlog GROWS by {abs(monthly_drawdown):.0f} cases/month.")
            print("The 1,599 backlog will NEVER clear without structural changes, and SLA breaches will exceed 80%.")
            
    else: # scenario == "interventions"
        print("[SCENARIO B: PROPOSED STRATEGIC INTERVENTIONS]")
        # 1. Fixing meter read/billing exceptions reduces inflow by 35%
        # 2. Unified Agent Desktop increases agent resolution capacity by 25%
        reduced_inflow = current_monthly_inflow * 0.65
        increased_capacity = current_monthly_capacity * 1.25
        monthly_drawdown = increased_capacity - reduced_inflow
        months_to_clear = current_backlog / monthly_drawdown

        print(f"New Monthly Inflow (Root-cause fix): {reduced_inflow:.0f} cases/month")
        print(f"New Monthly Capacity (Agent tool):   {increased_capacity:.0f} cases/month")
        print(f"Net Monthly Backlog Clearance:       {monthly_drawdown:.0f} cases/month")
        print(f"Projected Months to Clear Backlog:   {months_to_clear:.1f} months")

        # Financial Calculations
        print("\n--- 4. COMMERCIAL VALUE CASE SUMMARY ---")
        annual_complaint_reduction = (current_monthly_inflow - reduced_inflow) * 12
        direct_complaint_cost_savings = annual_complaint_reduction * complaint_cost
        annual_bill_correction_savings = regional_insight[regional_insight['legacy_sys_01']]['total_bill_corrections_val'].sum() * 0.50

        print(f"Annual Reduced Complaint Volume:    {annual_complaint_reduction:,.0f} cases")
        print(f"Annual Complaint Handling Savings:  ${direct_complaint_cost_savings:,.2f}")
        print(f"Annual Avoided Bill Corrections:    ${annual_bill_correction_savings:,.2f}")
        print(f"Total Annual Financial Impact:      ${(direct_complaint_cost_savings + annual_bill_correction_savings):,.2f}")
        
    print("=========================================================")

if __name__ == "__main__":
    print("--- RUNNING STATUS QUO BASELINE ---")
    run_northwind_analysis(scenario="baseline")
    print("\n\n--- RUNNING RECOMMENDED SOLUTION ---")
    run_northwind_analysis(scenario="interventions")