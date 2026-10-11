import json, math, subprocess, sys, time
name, lat, lon = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
dlat = 500 / 111320
dlon = 500 / (111320 * math.cos(math.radians(lat)))
S, N, W, E = lat - dlat, lat + dlat, lon - dlon, lon + dlon
def run(q, tries=6):
    for t in range(tries):
        r = subprocess.run(["curl", "-s", "-m", "120", "-A", "perspective-helper/1.0 (personal project)", "--data-urlencode", "data=" + q, "https://overpass-api.de/api/interpreter"], capture_output=True, text=True)
        try: return json.loads(r.stdout)["elements"]
        except Exception: time.sleep(8 * (t + 1))
    print("FAILED", q[:90], flush=True); return None
seen = {}
def add(els):
    for e in els or []: seen[(e["type"], e["id"])] = e
def cells(n):
    for i in range(n):
        for j in range(n):
            yield (S + (N - S) * i / n, W + (E - W) * j / n, S + (N - S) * (i + 1) / n, W + (E - W) * (j + 1) / n)
bb = lambda c: f"({c[0]:.6f},{c[1]:.6f},{c[2]:.6f},{c[3]:.6f})"
failed = []
for c in cells(3):
    r = run(f'[out:json][timeout:90];way["building"]{bb(c)};out tags geom;')
    if r is None: failed.append(c)
    add(r); print("b", len(seen), flush=True)
hw = 'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|pedestrian|living_street|service)$"]'
for c in cells(2):
    r = run(f'[out:json][timeout:90];{hw}{bb(c)};out tags geom;'); add(r); print("h", len(seen), flush=True)
whole = (S, W, N, E)
add(run(f'[out:json][timeout:90];(way["waterway"~"^(river|canal)$"]{bb(whole)};way["natural"~"^(water|riverbank)$"]{bb(whole)};);out tags geom;'))
add(run(f'[out:json][timeout:90];node["natural"="tree"]{bb(whole)};out;'))
json.dump({"center": [lat, lon], "bbox": [S, W, N, E], "elements": list(seen.values()), "failed": failed}, open(name + ".json", "w"))
print(name, len(seen), "failed cells", len(failed))
