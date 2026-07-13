import asyncio
from app.database import supabase, redis_client
from datetime import datetime, timedelta
import json
import os

def get_sla_targets():
    default_targets = {"repair": 3, "replacement": 5, "calibration": 14}
    if not redis_client:
        return default_targets
    try:
        data_str = redis_client.get("sla_settings")
        if data_str:
            data = json.loads(data_str)
            return {**default_targets, **data}
    except Exception as e:
        print(f"Error loading SLA settings from Redis: {e}")
    return default_targets

def run_sla_enforcement():
    try:
        print("[CRON] Running SLA enforcement job...")
        targets = get_sla_targets()
        
        # Fetch open tickets
        res = supabase.table("tickets").select("*").neq("status", "Closed").neq("status", "Escalated").execute()
        tickets = res.data
        
        escalated_count = 0
        for t in tickets:
            if not t.get("created_at"):
                continue
            # Handle tz aware iso format correctly
            try:
                created_at_str = t["created_at"]
                if created_at_str.endswith("Z"):
                    created_at_str = created_at_str[:-1] + "+00:00"
                created_at = datetime.fromisoformat(created_at_str)
                
                ticket_type = t.get("ticket_type", "Repair").lower()
                sla_days = targets.get(ticket_type, 3)
                
                expiration_date = created_at + timedelta(days=sla_days)
                now = datetime.now(created_at.tzinfo)
                
                if now > expiration_date:
                    print(f"[CRON] Escalating ticket {t['id']} (SLA breached)")
                    # Escalate ticket
                    supabase.table("tickets").update({"status": "Escalated"}).eq("id", t["id"]).execute()
                    
                    # Add history
                    supabase.table("ticket_history").insert({
                        "ticket_id": t["id"],
                        "new_status": "Escalated",
                        "changed_by_name": "System Cron",
                        "changed_by_role": "System",
                        "action": "SLA Breach Escalation",
                        "notes": f"Ticket automatically escalated because it exceeded the {sla_days}-day SLA limit."
                    }).execute()
                    escalated_count += 1
            except Exception as parse_e:
                print(f"Error parsing date for ticket {t['id']}: {parse_e}")
                
        return {"status": "success", "escalated": escalated_count}
    except Exception as e:
        print(f"[CRON] SLA enforcement error: {e}")
        return {"status": "error", "detail": str(e)}

def run_calibration_check():
    try:
        print("[CRON] Running Calibration Check job...")
        # Fetch active calibrations that are expiring
        res = supabase.table("calibrations").select("*").eq("status", "Active").execute()
        calibrations = res.data
        
        expired_count = 0
        for c in calibrations:
            if not c.get("next_due_date"):
                continue
            try:
                due_date = datetime.strptime(c["next_due_date"].split("T")[0], "%Y-%m-%d").date()
                today = datetime.now().date()
                days_remaining = (due_date - today).days
                
                if days_remaining <= 30 and days_remaining > 0:
                    print(f"[CRON] Calibration {c['id']} expiring soon ({days_remaining} days).")
                elif days_remaining <= 0:
                    print(f"[CRON] Calibration {c['id']} is EXPIRED. Escalate or Mark Expired.")
                    supabase.table("calibrations").update({"status": "Expired"}).eq("id", c["id"]).execute()
                    expired_count += 1
            except Exception as parse_e:
                print(f"Error checking calibration {c['id']}: {parse_e}")
                
        return {"status": "success", "expired": expired_count}
    except Exception as e:
        print(f"[CRON] Calibration check error: {e}")
        return {"status": "error", "detail": str(e)}
