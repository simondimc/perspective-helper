#!/usr/bin/env python3
"""Pretvori podatke OpenStreetMap + višinski model v datoteko scene za perspective-helper.

Uporaba:
  python3 tools/osm/fetch.py ime LAT LON          # prenese stavbe, ceste, vodo in drevesa (1 km x 1 km) -> ime.json
  python3 tools/osm/dem.py ime LAT LON 14 96      # doda višinski model (AWS Terrain Tiles, Terrarium) -> ime.json
  python3 tools/osm/osm2scene.py ime.json izhod.json "Ime scene" ljubljana|newyork

Viri: © OpenStreetMap contributors (ODbL), višine: Mapzen/AWS Terrain Tiles (SRTM, NED in drugi).
"""
import json, math, random, sys

src, dst, title, preset = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
d = json.load(open(src))
lat0, lon0 = d["center"]
S, W, N, E = d["bbox"]
KX = 111320 * math.cos(math.radians(lat0))
KZ = 111320
proj = lambda lat, lon: ((lon - lon0) * KX, -(lat - lat0) * KZ)
SIZE_X = (E - W) * KX
SIZE_Z = (N - S) * KZ
rnd = random.Random(7)
r1 = lambda v: round(v, 1)

# ---------------------------------------------------------------- teren
dem = d["dem"]
dn = len(dem) - 1
dmin = min(min(r) for r in dem)
CH = 4.0  # globina struge reke
HN = 260  # celice terena
def dem_at(x, z):
    u = min(dn - 1e-9, max(0, (x / SIZE_X + 0.5) * dn))
    v = min(dn - 1e-9, max(0, (z / SIZE_Z + 0.5) * dn))
    i, j = int(u), int(v)
    fu, fv = u - i, v - j
    a, b, c, e = dem[j][i], dem[j][i + 1], dem[j + 1][i], dem[j + 1][i + 1]
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + e) * fu * fv
els = d["elements"]
tags = lambda e: e.get("tags", {})
pts = lambda e: [proj(p["lat"], p["lon"]) for p in e.get("geometry", [])]
def rings_of(e):
    """Zunanji obroči večpoligona: odseke členov (way) povežem v sklenjene obroče."""
    segs = [[proj(p["lat"], p["lon"]) for p in m["geometry"]] for m in e.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
    out = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for k, sg in enumerate(segs):
                if sg[0] == ring[-1]: ring += sg[1:]
                elif sg[-1] == ring[-1]: ring += sg[::-1][1:]
                elif sg[-1] == ring[0]: ring = sg[:-1] + ring
                elif sg[0] == ring[0]: ring = sg[::-1][:-1] + ring
                else: continue
                segs.pop(k); changed = True; break
        if len(ring) > 3: out.append(ring)
    return out
# voda: poligoni in osi rek
water_polys, water_lines = [], []
for e in els:
    t = tags(e)
    if e["type"] == "way" and (t.get("natural") in ("water", "riverbank") or t.get("waterway") == "riverbank"):
        p = pts(e)
        if len(p) > 3: water_polys.append(p)
    elif e["type"] == "relation" and (t.get("natural") == "water" or t.get("waterway") == "riverbank"):
        water_polys.extend(rings_of(e))
    elif e["type"] == "way" and t.get("waterway") in ("river", "canal"):
        wd_ = 26 if t["waterway"] == "river" else 10
        if "Canal Grande" in t.get("name", ""): wd_ = 45
        water_lines.append((pts(e), wd_))
def in_poly(x, z, poly):
    inside = False
    n = len(poly)
    for k in range(n):
        x1, z1 = poly[k]; x2, z2 = poly[(k + 1) % n]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1: inside = not inside
    return inside
def seg_dist(x, z, a, b):
    ax, az = a; bx, bz = b
    dx, dz = bx - ax, bz - az
    L = dx * dx + dz * dz
    t = 0 if L == 0 else max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L))
    return math.hypot(x - (ax + t * dx), z - (az + t * dz))
def poly_edge_dist(x, z, poly):
    return min(seg_dist(x, z, poly[k], poly[(k + 1) % len(poly)]) for k in range(len(poly)))
def bbox_of(pts_):
    xs = [p[0] for p in pts_]; zs = [p[1] for p in pts_]
    return (min(xs), min(zs), max(xs), max(zs))
features = [("poly", p, bbox_of(p), 0) for p in water_polys] + [("line", l, bbox_of(l), w / 2) for l, w in water_lines]
MARGIN = 12.0
def sdf(x, z):
    """Predznačena razdalja do vode (negativno v vodi); velika vrednost, če je voda daleč."""
    best = 1e9
    for kind, g, (x0, z0, x1, z1), hw in features:
        if x < x0 - MARGIN - hw or x > x1 + MARGIN + hw or z < z0 - MARGIN - hw or z > z1 + MARGIN + hw: continue
        if kind == "poly":
            dd = poly_edge_dist(x, z, g)
            v = -dd if in_poly(x, z, g) else dd
        else:
            v = min(seg_dist(x, z, g[k], g[k + 1]) for k in range(len(g) - 1)) - hw
        best = min(best, v)
    return best
def smoothstep(a, b, v):
    t = max(0.0, min(1.0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)
def box_blur(grid, n, r):
    """Ločljiv premični povprečnik polmera r na mreži (n + 1)² (v seznamu vrstic)."""
    w = n + 1
    tmp = [0.0] * (w * w)
    for j in range(w):
        for i in range(w):
            lo, hi = max(0, i - r), min(n, i + r)
            tmp[j * w + i] = sum(grid[j * w + k] for k in range(lo, hi + 1)) / (hi - lo + 1)
    out = [0.0] * (w * w)
    for j in range(w):
        lo, hi = max(0, j - r), min(n, j + r)
        for i in range(w):
            out[j * w + i] = sum(tmp[k * w + i] for k in range(lo, hi + 1)) / (hi - lo + 1)
    return out
FLATTEN = False
BANK = 6.0   # širina blage brežine (m)
SHORE = 4.0  # voda sega do te razdalje od roba, preostanek zakrije teren
W1 = HN + 1
base = [dem_at((i / HN - 0.5) * SIZE_X, (j / HN - 0.5) * SIZE_Z) - dmin + CH for j in range(W1) for i in range(W1)]
sdfg = [sdf((i / HN - 0.5) * SIZE_X, (j / HN - 0.5) * SIZE_Z) for j in range(W1) for i in range(W1)]
# višinski model ima na vodi svojo (nižjo) površino: nodes v vodi nadomestim z vrednostmi z bregov (difuzija), da je nabrežje gladko
unknown = [k for k, sv in enumerate(sdfg) if sv <= 3.0]
if unknown and len(unknown) < len(base):
    isunk = [False] * len(base)
    for k in unknown: isunk[k] = True
    known = [base[k] for k in range(len(base)) if not isunk[k]]
    avg = sum(known) / len(known)
    for k in unknown: base[k] = avg
    for _ in range(400):
        for k in unknown:
            i, j = k % W1, k // W1
            nb = [base[k - 1] if i > 0 else base[k], base[k + 1] if i < HN else base[k], base[k - W1] if j > 0 else base[k], base[k + W1] if j < HN else base[k]]
            base[k] = 0.25 * (nb[0] + nb[1] + nb[2] + nb[3])
base = box_blur(base, HN, 2)  # blažitev terasastega reliefa iz višinskega modela
level = box_blur(base, HN, 16)  # gladka višina nabrežja: struga je izdolbena glede nanjo, zato je dno in gladina gladka
# gladina ob vodi: normalizirana konvolucija (povprečje ob vodi, ne čez cel teren), da je brez stopnic in sledi vodi
NODES = W1 * W1
mask = [1.0 if sv <= 8.0 else 0.0 for sv in sdfg]
num = box_blur([lv_ * m_ for lv_, m_ in zip(level, mask)], HN, 14)
den = box_blur(mask, HN, 14)
level = [num[k] / den[k] if mask[k] and den[k] > 1e-6 else level[k] for k in range(NODES)]
heights = []
for b, lv, sv in zip(base, level, sdfg):
    c = 1 - smoothstep(0, BANK, sv)
    heights.append(round(max(0.0, b * (1 - c) + (lv - CH) * c), 1))
HMAX = max(heights)
def bil(grid, x, z):
    u = min(HN - 1e-9, max(0, (x / SIZE_X + 0.5) * HN))
    v = min(HN - 1e-9, max(0, (z / SIZE_Z + 0.5) * HN))
    i, j = int(u), int(v)
    fu, fv = u - i, v - j
    a, b, c, e = grid[j * W1 + i], grid[j * W1 + i + 1], grid[(j + 1) * W1 + i], grid[(j + 1) * W1 + i + 1]
    return a + (b - a) * fu + (c - a) * fv + (a - b - c + e) * fu * fv
ground = lambda x, z: bil(heights, x, z)
objects = []
def put(typ, name, x, z, rot, size, y0, **extra):
    o = {"id": f"o{len(objects)}", "type": typ, "name": name, "position": [r1(x), r1(y0 + size[1] / 2), r1(z)], "rotation": [0, r1(rot), 0], "size": [r1(size[0]), r1(size[1]), r1(size[2])], "pose": {}}
    o.update(extra)
    objects.append(o)
    return o
terrain = put("terrain", "Teren", 0, 0, 0, [SIZE_X, HMAX + 0.01, SIZE_Z], 0, heights=heights, hn=HN)

# voda: vodoravni pasovi po vrsticah mreže; gladina 1 m nad dnom struge (3 m pod nabrežjem), brežine jo zakrijejo
dxc, dzc = SIZE_X / HN, SIZE_Z / HN
wpaths = []
for j in range(1, HN):
    row = [i for i in range(1, HN) if sdfg[j * W1 + i] <= SHORE]
    k = 0
    while k < len(row):
        a = k
        while k + 1 < len(row) and row[k + 1] == row[k] + 1: k += 1
        i0, i1 = row[a], row[k]
        zz = r1((j / HN - 0.5) * SIZE_Z)
        xa = (i0 / HN - 0.5) * SIZE_X - dxc / 2
        xb = (i1 / HN - 0.5) * SIZE_X + dxc / 2
        ya = level[j * W1 + i0] - (CH - 2.6)
        yb = level[j * W1 + i1] - (CH - 2.6)
        wpaths.append({"w": round(dzc + 0.02, 2), "p": [r1(xa), r1(ya), zz, r1(xb), r1(yb), zz]})
        k += 1
if wpaths:
    put("water", "Voda", 0, 0, 0, [SIZE_X, 1, SIZE_Z], 0, paths=wpaths)
    objects[-1]["position"] = [0, 0, 0]

# ---------------------------------------------------------------- stavbe
def hull(points):
    pts_ = sorted(set(points))
    if len(pts_) < 3: return pts_
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo = []
    for p in pts_:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts_):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def min_rect(poly):
    h = hull(poly)
    best = None
    for k in range(len(h)):
        ax, az = h[k]; bx, bz = h[(k + 1) % len(h)]
        a = math.atan2(bz - az, bx - ax)
        c, s = math.cos(-a), math.sin(-a)
        rx = [(x - ax) * c - (z - az) * s for x, z in h]
        rz = [(x - ax) * s + (z - az) * c for x, z in h]
        w, dd = max(rx) - min(rx), max(rz) - min(rz)
        if best is None or w * dd < best[0]:
            cx, cz = (max(rx) + min(rx)) / 2, (max(rz) + min(rz)) / 2
            wx = ax + cx * math.cos(a) - cz * math.sin(a)
            wz = az + cx * math.sin(a) + cz * math.cos(a)
            best = (w * dd, wx, wz, w, dd, a)
    return best  # area, cx, cz, w (vzdolž kota a), d, a
def num(v):
    try: return float(str(v).replace("m", "").strip().split(";")[0])
    except Exception: return None
DEFAULT_H = {"house": 7, "detached": 7, "terrace": 9, "residential": 12, "apartments": 18, "commercial": 14, "retail": 10, "office": 25, "industrial": 9, "garage": 3, "garages": 3, "shed": 3, "roof": 4, "church": 16, "cathedral": 30, "chapel": 8, "hotel": 22, "university": 18, "school": 12, "hospital": 18, "public": 14}
dflt = {"ljubljana": 8, "paris": 20, "london": 15, "tokyo": 14, "rome": 18, "venice": 14}.get(preset, 22)  # newyork, fidi: 22
MIN_AREA = 55 if preset == "tokyo" else 35
n_b = 0
bsrc = []
for e in els:
    t = tags(e)
    if "building" not in t: continue
    if e["type"] == "way": bsrc.append((t, pts(e)))
    elif e["type"] == "relation":
        for ring in rings_of(e): bsrc.append((t, ring))
for t, poly in bsrc:
    if len(poly) < 4: continue
    area, cx, cz, w, dd, a = min_rect(poly)
    if area < MIN_AREA: continue
    h = num(t.get("height")) or ((num(t.get("building:levels")) or 0) * 3.2 + 1.0 if t.get("building:levels") else None) or DEFAULT_H.get(t["building"], dflt)
    h = max(3.0, min(h, 460))
    g = min(ground(cx, cz), ground(cx + w / 2 * math.cos(a), cz + w / 2 * math.sin(a)), ground(cx - w / 2 * math.cos(a), cz - w / 2 * math.sin(a)))
    y0 = g - 0.4
    H = h + 0.4
    if t.get("name") == "London Eye":  # v OSM je kolo tanka visoka »stavba«: nadomestim s pravim modelom, ravnina kolesa po stranici tlorisa
        put("ferris", "London Eye", cx, cz, -math.degrees(a) if w >= dd else -math.degrees(a) + 90, [120, 135, 40], ground(cx, cz))
        n_b += 1
        continue
    if "olosse" in t.get("name", "") and area > 8000:  # Koloseum: eliptični obroč namesto pravokotnika
        if dd > w: w, dd, a = dd, w, a + math.pi / 2
        put("colosseum", "Koloseum", cx, cz, -math.degrees(a), [w, 48, dd], ground(cx, cz))
        n_b += 1
        continue
    if "Eiffel" in t.get("name", "") and t.get("man_made") == "tower":
        put("eiffel", "Eifflov stolp", cx, cz, -math.degrees(a), [max(w, dd), 330, max(w, dd)], ground(cx, cz))
        n_b += 1
        continue
    name = t.get("name") or t.get("addr:housename") or {"church": "Cerkev", "cathedral": "Katedrala"}.get(t["building"], "Stavba")
    rot = -math.degrees(a)
    if t["building"] in ("church", "cathedral") and area > 150:
        if dd < w: w, dd, rot = dd, w, rot - 90  # ladja vzdolž Z
        typ = "church"
    elif h >= 80 and min(w, dd) / max(w, dd) > 0.5 and area < 5000:
        typ = "tower"
    elif h <= 14 and area < 700:
        typ = "shell"
        if dd > w: w, dd, rot = dd, w, rot - 90  # greben vzdolž daljše stranice
    else:
        typ = "box"
    put(typ, name, cx, cz, rot, [w, H, dd], y0)
    n_b += 1

# ---------------------------------------------------------------- ceste
WIDTH = {"motorway": 16, "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 8, "residential": 6, "unclassified": 6, "living_street": 5, "pedestrian": 5, "service": 3.5}
paths = []
road_runs = []
for e in els:
    t = tags(e)
    if e["type"] != "way" or "highway" not in t or t.get("tunnel") in ("yes", "building_passage"): continue
    p = pts(e)
    if len(p) < 2: continue
    # gostitev točk (največ ~8 m), da trak sledi terenu
    dense = [p[0]]
    for k in range(1, len(p)):
        (x0, z0), (x1, z1) = p[k - 1], p[k]
        L = math.hypot(x1 - x0, z1 - z0)
        for s in range(1, max(1, int(L / 8)) + 1):
            f = s / max(1, int(L / 8))
            dense.append((x0 + (x1 - x0) * f, z0 + (z1 - z0) * f))
    bridge = t.get("bridge") in ("yes", "viaduct")
    if bridge and any(sdf(x, z) < 4.0 for x, z in dense):
        # most čez vodo: pravi objekt »Most« (krov, ograja in oporniki) med obema bregovoma, vrh krova v ravni nabrežja
        (bx0, bz0), (bx1, bz1) = dense[0], dense[-1]
        L = math.hypot(bx1 - bx0, bz1 - bz0)
        if L > 8:
            mx, mz = (bx0 + bx1) / 2, (bz0 + bz1) / 2
            ang = -math.degrees(math.atan2(bz1 - bz0, bx1 - bx0))
            wdt = WIDTH.get(t["highway"], 5) + 1.0
            put("bridge", t.get("name") or "Most", mx, mz, ang, [L + 2, CH + 1.35, wdt], bil(level, mx, mz) - CH)
            continue
    if bridge:
        yb = (bil(level, *dense[0]) + bil(level, *dense[-1])) / 2 + 0.35
        runs = [[(x, yb, z) for x, z in dense]]
    else:
        runs, cur = [], []
        for x, z in dense:
            if sdf(x, z) < 4.0:  # ne čez vodo in strmo brežino
                if len(cur) > 1: runs.append(cur)
                cur = []
            else:
                cur.append((x, ground(x, z) + 0.35, z))
        if len(cur) > 1: runs.append(cur)
    for run in runs:
        flat = []
        for x, y, z in run: flat += [r1(x), r1(y), r1(z)]
        paths.append({"w": WIDTH.get(t["highway"], 5), "p": flat})
        if not bridge: road_runs.append((t["highway"], run))
put("roads", "Ceste", 0, 0, 0, [SIZE_X, 1, SIZE_Z], 0, paths=paths)
objects[-1]["position"] = [0, 0, 0]

# ---------------------------------------------------------------- avtomobili, ljudje in ladje
LEFT_TRAFFIC = preset in ("london", "tokyo")
SPACING = {"motorway": 22, "trunk": 24, "primary": 26, "secondary": 32, "tertiary": 40, "residential": 70, "unclassified": 80}
car_pts = []
walk_pts = []
for hw, run in road_runs:
    if len(run) < 2: continue
    acc = rnd.random() * SPACING.get(hw, 80)
    wacc = rnd.random() * 45
    for k in range(1, len(run)):
        (x0, y0_, z0), (x1, y1_, z1) = run[k - 1], run[k]
        L = math.hypot(x1 - x0, z1 - z0)
        if L < 0.5: continue
        dx, dz = (x1 - x0) / L, (z1 - z0) / L
        t_ = 0.0
        while hw in SPACING and acc < L - t_:
            t_ += acc
            acc = SPACING[hw] * (0.7 + 0.6 * rnd.random())
            sgn = 1 if rnd.random() < 0.5 else -1
            ddx, ddz = dx * sgn, dz * sgn
            rx, rz = -ddz, ddx  # desno od smeri vožnje
            off = 1.8 * (-1 if LEFT_TRAFFIC else 1)
            px, pz = x0 + dx * t_ + rx * off, z0 + dz * t_ + rz * off
            car_pts.append((px, pz, y0_ + (y1_ - y0_) * t_ / L, math.degrees(math.atan2(ddx, ddz)), hw in ("primary", "secondary", "trunk")))
        acc -= (L - t_)
        # pešci ob ulicah (pločnik ob robu)
        t2 = 0.0
        while wacc < L - t2:
            t2 += wacc
            wacc = 55 * (0.6 + 0.8 * rnd.random())
            side = 1 if rnd.random() < 0.5 else -1
            wd = WIDTH.get(hw, 5) / 2 + 1.2
            walk_pts.append((x0 + dx * t2 - dz * wd * side, z0 + dz * t2 + dx * wd * side, y0_ + (y1_ - y0_) * t2 / L, rnd.random() * 360))
        wacc -= (L - t2)
rnd.shuffle(car_pts)
rnd.shuffle(walk_pts)
def pick_vehicle(big_road):
    r_ = rnd.random()
    if big_road and r_ < 0.07: return "bus", [2.55, 3.2, 11 + rnd.random() * 2]
    if r_ < 0.18: return "van", [2.0, 2.4 + rnd.random() * 0.2, 5.0 + rnd.random() * 0.8]
    if r_ < 0.42: return "suv", [1.95, 1.75 + rnd.random() * 0.1, 4.6 + rnd.random() * 0.3]
    if r_ < 0.70: return "hatch", [1.75, 1.45, 3.8 + rnd.random() * 0.3]
    return "car", [1.8, 1.45, 4.4 + rnd.random() * 0.3]
for x, z, y, a, big in car_pts[:150]:
    kind_, sz_ = pick_vehicle(big)
    put(kind_, {"bus": "Avtobus", "van": "Kombi", "suv": "SUV", "hatch": "Avto", "car": "Avto"}[kind_], x, z, a, [r1(v_) for v_ in sz_], y)
for i, (x, z, y, a) in enumerate(walk_pts[:60]):
    o = put("woman" if i % 2 else "figure", "Pešec", x, z, a, [0.5, 1.7, 0.28] if i % 2 else [0.57, 1.8, 0.31], y)
# ladje po sredinski osi reke
for line, w_ in water_lines:
    if w_ < 20 or len(line) < 3: continue
    nb = 0
    k = 2
    while k < len(line) - 1 and nb < (30 if preset == "venice" else 8):
        (x0, z0), (x1, z1) = line[k], line[k + 1]
        L = math.hypot(x1 - x0, z1 - z0)
        if L > 1:
            ii = int(round((x0 / SIZE_X + 0.5) * HN)); jj = int(round((z0 / SIZE_Z + 0.5) * HN))
            if 0 < ii < HN and 0 < jj < HN and sdfg[jj * W1 + ii] <= 0:
                wl = level[jj * W1 + ii] - (CH - 2.6)
                dirx, dirz = (x1 - x0) / L, (z1 - z0) / L
                sgn = 1 if nb % 2 == 0 else -1
                put("boat", "Ladja", x0 + (-dirz) * 3 * sgn, z0 + dirx * 3 * sgn, math.degrees(math.atan2(dirx * sgn, dirz * sgn)), ([1.5, 1.6, 11] if preset == "venice" else ([5, 3.4, 20] if rnd.random() < 0.5 else [4, 3.0, 14])), wl - 0.5)
                nb += 1
        k += max(2, int(120 / max(L, 1)))

# ---------------------------------------------------------------- drevesa
trees = [e for e in els if e["type"] == "node" and tags(e).get("natural") == "tree"]
rnd.shuffle(trees)
for e in trees[:260]:
    x, z = proj(e["lat"], e["lon"])
    gy = ground(x, z)
    if gy < 1.0: continue
    s = 4 + rnd.random() * 3
    put("tree", "Drevo", x, z, 0, [s, 7 + rnd.random() * 4, s], gy)

# ---------------------------------------------------------------- obrobje (preprosti bloki, da mesta ni videti konec)
ring = []
step = 75
SKIP_RING = True  # samo območje 1 x 1 km, brez obrobnih splošnih stavb
for ix in range(-18, 19):
    for iz in range(-18, 19):
        x, z = ix * step, iz * step
        if abs(x) < SIZE_X / 2 + 20 and abs(z) < SIZE_Z / 2 + 20: continue
        if math.hypot(x, z) > 1300: continue
        base = (rnd.random() * 14 + 6) if preset == "ljubljana" else (rnd.random() * 90 + 25)
        ring.append((x + (rnd.random() - 0.5) * 30, z + (rnd.random() - 0.5) * 30, base))
for x, z, hh in ([] if SKIP_RING else ring):
    put("box", "Stavba", x, z, rnd.random() * 90, [28 + rnd.random() * 30, hh, 28 + rnd.random() * 30], 0)

# kamera
def lookat(px, pz, eye, tx, tz, ty, **kw):
    dx, dz = tx - px, tz - pz
    dist = math.hypot(dx, dz)
    cam = {"mode": "3pt", "x": px, "z": pz, "eyeHeight": eye, "yaw": round(math.degrees(math.atan2(dx, -dz)), 1), "pitch": round(-math.degrees(math.atan2(eye - ty, dist)), 1), "roll": 0, "focalMm": 20, "shiftY": -0.1, "aspect": "3:2", "projection": "rectilinear"}
    cam.update(kw)
    return cam
if preset == "ljubljana":
    cam = lookat(-260, 440, 110, 40, -60, 30, focalMm=20)  # z juga nad mestom proti Prešernovemu trgu in gradu
elif preset == "fidi":
    cam = lookat(-470, 330, 230, 60, -120, 90, focalMm=20)  # z zahoda, čez Hudson, proti Wall Streetu in One WTC
elif preset == "paris":   # pogled čez Seno proti Eifflovemu stolpu (stolp je ~145 m južno od središča)
    cam = lookat(60, -450, 70, -37, 145, 120, focalMm=22)
elif preset == "london":  # pogled čez Temzo proti Big Benu in parlamentu
    cam = lookat(420, 400, 150, -40, -20, 40, focalMm=22)
elif preset == "rome":
    cam = lookat(260, 470, 160, 0, 0, 25, focalMm=22)
elif preset == "venice":
    cam = lookat(300, 440, 300, -40, -60, 0, focalMm=24)
elif preset == "tokyo":   # pogled proti križišču Shibuya
    cam = lookat(-230, 450, 230, -45, 0, 10, focalMm=20)
else:  # newyork: mreža ulic je zasukana ~29° proti vzhodu glede na sever
    cam = {"mode": "3pt", "x": 150, "z": 470, "eyeHeight": 140, "yaw": 29, "pitch": -20, "roll": 0, "focalMm": 18, "shiftY": -0.1, "aspect": "3:2", "projection": "rectilinear"}
base_state = json.load(open("src/default-scene.json"))
scene = {"version": 1, "name": title, "objects": objects, "camera": cam, "light": base_state["light"], "guides": base_state["guides"], "view": base_state["view"]}
json.dump(scene, open(dst, "w"), separators=(",", ":"))
print(title, "objects", len(objects), "buildings", n_b, "road paths", len(paths), "bytes", len(json.dumps(scene)))
