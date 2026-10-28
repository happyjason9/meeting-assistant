"""Corner cobweb: spokes radiating from the top-left corner (0,0), joined by sagging
threads. Output is anchored top-left; CSS flips it (scaleX/scaleY -1) for other corners.
usage: python3 gen_web.py out.svg [seed]"""
import math, random, sys
out = sys.argv[1]
rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 3)
S = 200
spokes = 7
angles = [math.radians(2 + i * (86 / (spokes - 1)) + rng.uniform(-3, 3)) for i in range(spokes)]
lengths = [S * rng.uniform(0.82, 1.0) for _ in angles]
paths = []
for a, L in zip(angles, lengths):
    paths.append(f"M0 0L{math.cos(a)*L:.1f} {math.sin(a)*L:.1f}")
# 一圈圈的橫絲：相鄰主線之間用往角落方向下垂的弧線連起來
rings = [0.18, 0.32, 0.47, 0.62, 0.77, 0.9]
for r in rings:
    d = []
    for i in range(spokes - 1):
        r1 = r * rng.uniform(0.95, 1.05); r2 = r * rng.uniform(0.95, 1.05)
        p1 = (math.cos(angles[i]) * S * r1, math.sin(angles[i]) * S * r1)
        p2 = (math.cos(angles[i+1]) * S * r2, math.sin(angles[i+1]) * S * r2)
        mid_a = (angles[i] + angles[i+1]) / 2
        sag = S * r * 0.82   # 中點往角落收，形成下垂
        c = (math.cos(mid_a) * sag, math.sin(mid_a) * sag)
        d.append((f"M{p1[0]:.1f} {p1[1]:.1f}" if i == 0 else "") + f"Q{c[0]:.1f} {c[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    paths.append("".join(d))
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">'
       f'<g fill="none" stroke="#efe6ff" stroke-linecap="round" stroke-linejoin="round">'
       + "".join(f'<path d="{p}" stroke-width="{1.6 if p.startswith("M0 0L") else 1.1}"/>' for p in paths)
       + '</g></svg>')
open(out, "w").write(svg)
