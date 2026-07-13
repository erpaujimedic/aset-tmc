def normalize_branch_name(branch: str) -> str:
    if not branch:
        return branch
        
    b = str(branch).strip()
    upper_b = b.upper()
    
    if upper_b in ["ALL BRANCHES", "ALL"]:
        return "All Branches"
        
    if upper_b == "HEAD OFFICE":
        return "Head Office"
        
    if upper_b.startswith("TMC "):
        suffix = b[4:].strip().title()
        return f"TMC {suffix}"
        
    return b.title()
