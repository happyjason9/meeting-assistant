"""Generate a bare, gnarled tree silhouette (deterministic). Branches are tapered
filled shapes along slightly curved paths so it reads like a dead tree, not a stick figure."""
import math, random, sys
seed, out, W, H = int(sys.argv[1]), sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
lean = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
TRUNK = float(sys.argv[6]) if len(sys.argv) > 6 else 0.27
rng = random.Random(seed)
parts = []

def branch(x, y, ang, length, width, depth):
    # curved segment: control point bends sideways
    bend = rng.uniform(-0.6, 0.6)
    x2 = x + math.cos(ang) * length
    y2 = y + math.sin(ang) * length
    cx = (x + x2) / 2 + math.cos(ang + math.pi / 2) * length * bend * 0.5
    cy = (y + y2) / 2 + math.sin(ang + math.pi / 2) * length * bend * 0.5
    w2 = max(width * 0.58, 1.4)
    # tapered quad: offset both sides
    def off(px, py, a, w): return (px + math.cos(a + math.pi/2) * w/2, py + math.sin(a + math.pi/2) * w/2,
                                   px - math.cos(a + math.pi/2) * w/2, py - math.sin(a + math.pi/2) * w/2)
    a1 = math.atan2(cy - y, cx - x); a2 = math.atan2(y2 - cy, x2 - cx)
    l1x, l1y, r1x, r1y = off(x, y, a1, width)
    l2x, l2y, r2x, r2y = off(x2, y2, a2, w2)
    lcx, lcy, rcx, rcy = off(cx, cy, (a1 + a2) / 2, (width + w2) / 2)
    parts.append(f"M{l1x:.1f} {l1y:.1f}Q{lcx:.1f} {lcy:.1f} {l2x:.1f} {l2y:.1f}"
                 f"L{r2x:.1f} {r2y:.1f}Q{rcx:.1f} {rcy:.1f} {r1x:.1f} {r1y:.1f}Z")
    parts.append(f"M{x2 + w2/2:.1f} {y2:.1f}a{w2/2:.1f} {w2/2:.1f} 0 1 0 {-w2:.1f} 0a{w2/2:.1f} {w2/2:.1f} 0 1 0 {w2:.1f} 0Z")
    if depth == 0 or length < 8:
        return
    n = 2 if depth > 1 else rng.choice([2, 3])
    for i in range(n):
        spread = rng.uniform(0.3, 0.6) * (1 if i % 2 == 0 else -1)
        if n == 3 and i == 2: spread = rng.uniform(-0.15, 0.15)
        branch(x2, y2, a2 + spread, length * rng.uniform(0.6, 0.74), w2 * rng.uniform(0.8, 1.0), depth - 1)

# trunk from bottom center, leaning
trunk_w = H * 0.085
# 樹根處加寬的底座，讓樹看起來紮在地上
parts.append(f"M{W*0.5 - trunk_w*1.1:.1f} {H}Q{W*0.5 - trunk_w*0.5:.1f} {H - H*0.05:.1f} {W*0.5 - trunk_w*0.5:.1f} {H - H*0.12:.1f}"
             f"L{W*0.5 + trunk_w*0.5:.1f} {H - H*0.12:.1f}Q{W*0.5 + trunk_w*0.5:.1f} {H - H*0.05:.1f} {W*0.5 + trunk_w*1.1:.1f} {H}Z")
branch(W * 0.5, H, -math.pi/2 + lean, H * TRUNK, trunk_w, 5)
open(out, "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
                     f'<g fill="#6b4f96">' + "".join(f'<path d="{d}"/>' for d in parts) + '</g></svg>')
print(len(parts), "shapes")
