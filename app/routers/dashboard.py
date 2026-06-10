from fastapi import APIRouter, HTTPException
from app.database import supabase
from collections import Counter
from datetime import datetime, timedelta

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        # Fetch all assets to calculate stats
        assets_res = supabase.table("assets").select("*").execute()
        assets = assets_res.data
        
        # Fetch branches count
        branches_res = supabase.table("branches").select("id").execute()
        total_branches = len(branches_res.data)

        # Fetch tickets count
        tickets_res = supabase.table("tickets").select("id, status").execute()
        tickets = tickets_res.data
        open_tickets = len([t for t in tickets if t.get("status") == "Open" or t.get("status") == "In Progress"])

        # Calculate counts
        total_assets = len(assets)
        status_counts = Counter(a.get("status", "Unknown") for a in assets)

        in_transit = status_counts.get("In Transit", 0)
        maintenance = status_counts.get("Maintenance", 0)

        status_distribution = [
            {"value": status_counts.get("Active", 0), "name": "Active"},
            {"value": status_counts.get("In Transit", 0), "name": "In Transit"},
            {"value": status_counts.get("Maintenance", 0), "name": "Maintenance"},
            {"value": status_counts.get("Deployed", 0), "name": "Deployed"},
            {"value": status_counts.get("Retired", 0), "name": "Retired"}
        ]

        # Dummy historical growth for the chart
        asset_growth = [12, 20, 15, 8, 7, 11]

        # Fetch recent activities (movements and logs)
        logs_res = supabase.table("movement_logs").select("*, asset_movements(tracking_code, assets(name))").order("created_at", desc=True).limit(5).execute()
        recent_activities = []
        for log in logs_res.data:
            # handle nested structure safely
            asset_movements = log.get("asset_movements") or {}
            assets_info = asset_movements.get("assets") or {}
            asset_name = assets_info.get("name") if isinstance(assets_info, dict) else "Unknown"
            tracking_code = asset_movements.get("tracking_code", "Unknown")
            recent_activities.append({
                "id": log["id"],
                "status_update": log["status_update"],
                "description": log["description"],
                "created_at": log["created_at"],
                "asset_name": asset_name,
                "tracking_code": tracking_code,
                "updated_by": log["updated_by"]
            })

        # Calculate alerts (e.g. overdue movements)
        # Fetch active movements
        movements_res = supabase.table("asset_movements").select("*").eq("status", "In Transit").execute()
        alerts = []
        for mov in movements_res.data:
            if mov.get("expected_return_date"):
                try:
                    expected_date = datetime.strptime(mov["expected_return_date"], "%Y-%m-%d")
                    if datetime.now() > expected_date:
                        alerts.append({
                            "type": "overdue",
                            "message": f"Asset {mov.get('asset_id')} is overdue for return.",
                            "tracking_code": mov["tracking_code"]
                        })
                except Exception:
                    pass

        return {
            "totalAssets": total_assets,
            "inTransit": in_transit,
            "maintenance": maintenance,
            "totalBranches": total_branches,
            "statusDistribution": status_distribution,
            "assetGrowth": asset_growth,
            "recentActivities": recent_activities,
            "alerts": alerts,
            "openTickets": open_tickets
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
