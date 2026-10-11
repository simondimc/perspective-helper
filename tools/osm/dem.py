import json, math, struct, subprocess, sys, zlib
def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y
def fetch_png(z, x, y):
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    return subprocess.run(["curl", "-s", "-m", "60", "-A", "perspective-helper/1.0", url], capture_output=True).stdout
def decode_png(b):
    assert b[:8] == b"\x89PNG\r\n\x1a\n"
    pos = 8; idat = b""; w = h = bd = ct = il = 0
    while pos < len(b):
        ln, = struct.unpack(">I", b[pos:pos + 4]); typ = b[pos + 4:pos + 8]; data = b[pos + 8:pos + 8 + ln]; pos += 12 + ln
        if typ == b"IHDR": w, h, bd, ct, _, _, il = struct.unpack(">IIBBBBB", data)
        elif typ == b"IDAT": idat += data
    assert bd == 8 and il == 0 and ct in (2, 6), (bd, ct, il)
    bpp = 3 if ct == 2 else 4
    raw = zlib.decompress(idat); stride = w * bpp
    rows = []; prev = bytearray(stride); p = 0
    for _ in range(h):
        f = raw[p]; line = bytearray(raw[p + 1:p + 1 + stride]); p += 1 + stride
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0; up = prev[i]; c = prev[i - bpp] if i >= bpp else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + up) & 255
            elif f == 3: line[i] = (line[i] + ((a + up) >> 1)) & 255
            elif f == 4:
                pa = abs(up - c); pb = abs(a - c); pc = abs(a + up - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (up if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        rows.append(line); prev = line
    return w, h, bpp, rows
name, lat, lon, z = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4])
d = json.load(open(name + ".json")); S, W, N, E = d["bbox"]
N_GRID = int(sys.argv[5])
tiles = {}
def elev(la, lo):
    tx, ty = tile_xy(la, lo, z); ix, iy = int(tx), int(ty)
    if (ix, iy) not in tiles: tiles[(ix, iy)] = decode_png(fetch_png(z, ix, iy))
    w, h, bpp, rows = tiles[(ix, iy)]
    px = min(w - 1, int((tx - ix) * w)); py = min(h - 1, int((ty - iy) * h))
    r = rows[py]; o = px * bpp
    return r[o] * 256 + r[o + 1] + r[o + 2] / 256 - 32768
grid = []
for j in range(N_GRID + 1):
    la = N - (N - S) * j / N_GRID
    grid.append([round(elev(la, W + (E - W) * i / N_GRID), 2) for i in range(N_GRID + 1)])
d["dem"] = grid
json.dump(d, open(name + ".json", "w"))
flat = [v for r in grid for v in r]
print(name, "dem", N_GRID, min(flat), max(flat))
