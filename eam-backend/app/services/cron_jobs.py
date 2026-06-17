import asyncio
from app.database import supabase
from datetime import datetime, timedelta
import json
import os

SLA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sla_settings.json")

def get_sla_targets():
    default_targets = {"repair": 3, "replacement": 5, "calibration": 14}
    if os.path.exists(SLA_FILE):
        try:
            with open(SLA_FILE, "r") as f:
                data = json.load(f)
                return {**default_targets, **data}
        except:
            pass
    return default_targets

async def enforce_sla_loop():
    while True:
        try:
            print("[CRON] Running SLA enforcement job...")
            targets = get_sla_targets()
            
            # Fetch open tickets
            res = supabase.table("tickets").select("*").neq("status", "Closed").neq("status", "Escalated").execute()
            tickets = res.data
            
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
                except Exception as parse_e:
                    print(f"Error parsing date for ticket {t['id']}: {parse_e}")
                    
        except Exception as e:
            print(f"[CRON] SLA enforcement error: {e}")
            
        await asyncio.sleep(3600) # Run every 1 hour

async def check_calibration_loop():
    while True:
        try:
            print("[CRON] Running Calibration Check job...")
            # Fetch active calibrations that are expiring in 30 days
            res = supabase.table("calibrations").select("*").eq("status", "Active").execute()
            calibrations = res.data
            
            for c in calibrations:
                if not c.get("next_due_date"):
                    continue
                try:
                    due_date = datetime.strptime(c["next_due_date"], "%Y-%m-%d").date()
                    today = datetime.now().date()
                    days_remaining = (due_date - today).days
                    
                    if days_remaining <= 30 and days_remaining > 0:
                        print(f"[CRON] Calibration {c['id']} expiring soon ({days_remaining} days).")
                        # We could send an email or update a 'warning' status, but for now we just log it
                        # Since the UI already highlights items <= 30 days, we might just want to auto-create a ticket if days_remaining == 0
                    elif days_remaining <= 0:
                        print(f"[CRON] Calibration {c['id']} is EXPIRED. Escalate or Mark Expired.")
                        supabase.table("calibrations").update({"status": "Expired"}).eq("id", c["id"]).execute()
                        
                        # Optionally create an auto-ticket here...
                except Exception as parse_e:
                    print(f"Error checking calibration {c['id']}: {parse_e}")
                    
        except Exception as e:
            print(f"[CRON] Calibration check error: {e}")
            
        await asyncio.sleep(86400) # Run every 24 hours
