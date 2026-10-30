"""Priprema Microsoftovih primjera podataka za lokql: ujednačena imena kolona (TimeGenerated) i tabela."""
import csv, sys
csv.field_size_limit(sys.maxsize)

def prep(src, dst, rename=None, drop_empty=True):
    rows = list(csv.DictReader(open(src, encoding="utf-8-sig", newline="")))
    cols = list(rows[0].keys())
    if rename:
        rows = [{rename.get(k, k): v for k, v in r.items()} for r in rows]
        cols = [rename.get(k, k) for k in cols]
    if drop_empty:
        cols = [c for c in cols if any(r[c] not in ("", None) for r in rows)]
    with open(dst, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)
    print(dst, len(rows), "redova,", len(cols), "kolona")

prep("SecurityEvent.raw.csv", "SecurityEvent.csv", {"TimeGenerated [UTC]": "TimeGenerated"})
prep("DeviceProcessEvents.raw.csv", "DeviceProcessEvents.csv", {"TimeGenerated [UTC]": "TimeGenerated", "Timestamp [UTC]": "Timestamp"})
prep("AzureFirewall.raw.csv", "AzureFirewall.csv", {"TimeGenerated [UTC]": "TimeGenerated"})
