"""Creepy vine wrapping a card's bottom-left corner: climbs down the left edge, bends around
the rounded corner and creeps along the bottom edge, tapering to a curl. Thorns, spiral
tendrils and a few withered leaves along the way.
Anchored bottom-left; CSS flips it (scaleX -1) for the bottom-right corner.
Card corner sits at (PAD, H - PAD) in the SVG, card radius 18px.
usage: python3 gen_vine.py out.svg [seed]"""
import math, random, sys
out = sys.argv[1]
rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 7)

W, H, PAD = 420, 112, 16          # card's left edge x = PAD, bottom edge y = H - PAD
R = 18                            # card radius
STEM = "#3a4a2c"
STEM_HI = "#7a9a52"
THORN = "#232d1c"
LEAF = "#46573a"
LEAF_VEIN = "#1f2a1a"
BERRY = "#b36bff"


def centerline(t):
    """t in [0,1] → point on the card border (left edge → corner → bottom edge)."""
    left_len = H - PAD - R - 30                     # left edge, from y=20 down to the corner
    arc_len = math.pi / 2 * R
    bottom_len = W - PAD - R - 30
    total = left_len + arc_len + bottom_len
    s = t * total
    if s < left_len:
        return PAD, 30 + s, (0, 1)
    s -= left_len
    if s < arc_len:
        a = math.pi - s / R                         # from 180° to 90°（往下、往右）
        cx, cy = PAD + R, H - PAD - R
        return cx + math.cos(a) * R, cy + math.sin(a) * R, (math.sin(a), -math.cos(a))
    s -= arc_len
    return PAD + R + s, H - PAD, (1, 0)


# Main stem: weaves across the border (in and out of the card) with a slow wobble
N = 260
pts = []
for i in range(N + 1):
    t = i / N
    x, y, (tx, ty) = centerline(t)
    nx, ny = -ty, tx                                 # normal
    wob = math.sin(t * 13.0 + 0.6) * 7 + math.sin(t * 31.0) * 2.2
    pts.append((x + nx * wob, y + ny * wob, nx, ny, tx, ty, t))


def width(t):
    return 6.4 * (1 - t) ** 0.7 + 0.8


left, right = [], []
for x, y, nx, ny, tx, ty, t in pts:
    w = width(t) / 2
    left.append((x + nx * w, y + ny * w))
    right.append((x - nx * w, y - ny * w))
ribbon = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in left + right[::-1]) + "Z"
hilite = "M" + " L".join(f"{x + nx * width(t) * 0.18:.1f} {y + ny * width(t) * 0.18:.1f}"
                         for x, y, nx, ny, tx, ty, t in pts[:-20])

# A thinner second strand twisting around the main one
twist = []
for x, y, nx, ny, tx, ty, t in pts[:int(N * 0.75)]:
    off = math.sin(t * 48) * (width(t) + 3)
    twist.append(f"{x + nx * off:.1f} {y + ny * off:.1f}")
twist = "M" + " L".join(twist)

# Thorns: small curved hooks, alternating sides
thorns = []
for i in range(10, N - 20, 11):
    x, y, nx, ny, tx, ty, t = pts[i]
    side = 1 if (i // 11) % 2 else -1
    L = 6 + 5 * (1 - t) + rng.uniform(-1, 1.5)
    w = width(t) / 2
    bx, by = x + nx * w * side, y + ny * w * side
    tipx = bx + nx * L * side + tx * L * 0.55
    tipy = by + ny * L * side + ty * L * 0.55
    b1 = (bx - tx * 2.4, by - ty * 2.4)
    b2 = (bx + tx * 2.4, by + ty * 2.4)
    thorns.append(f"M{b1[0]:.1f} {b1[1]:.1f}Q{bx + nx * L * 0.6 * side:.1f} {by + ny * L * 0.6 * side:.1f} "
                  f"{tipx:.1f} {tipy:.1f}L{b2[0]:.1f} {b2[1]:.1f}Z")

# Spiral tendrils curling off the stem
tendrils = []
for i in (40, 105, 170, N - 8):
    x, y, nx, ny, tx, ty, t = pts[i]
    side = rng.choice((-1, 1)) if i != N - 8 else 1
    base_a = math.atan2(ny * side, nx * side)
    turns = rng.uniform(1.4, 2.0)
    r0 = rng.uniform(13, 18) * (1.2 if i == N - 8 else 1)
    d = []
    steps = 60
    cx = x + math.cos(base_a) * r0
    cy = y + math.sin(base_a) * r0
    for k in range(steps + 1):
        u = k / steps
        a = base_a + math.pi + u * turns * 2 * math.pi * side
        r = r0 * (1 - u * 0.85)
        d.append(f"{cx + math.cos(a) * r:.1f} {cy + math.sin(a) * r:.1f}")
    tendrils.append("M" + " L".join(d))

# Withered leaves: pointed, slightly curled, with a vein
leaves = []
for i in (25, 75, 130, 200):
    x, y, nx, ny, tx, ty, t = pts[i]
    side = 1 if i in (25, 130) else -1
    L = rng.uniform(15, 21) * (1 - t * 0.35)
    a = math.atan2(ny * side, nx * side) + rng.uniform(-0.5, 0.5) + 0.5 * side
    ex, ey = x + math.cos(a) * L, y + math.sin(a) * L
    px, py = -math.sin(a), math.cos(a)
    bw = L * 0.36
    c1 = (x + math.cos(a) * L * 0.4 + px * bw, y + math.sin(a) * L * 0.4 + py * bw)
    c2 = (x + math.cos(a) * L * 0.55 - px * bw * 0.7, y + math.sin(a) * L * 0.55 - py * bw * 0.7)
    leaves.append((f"M{x:.1f} {y:.1f}Q{c1[0]:.1f} {c1[1]:.1f} {ex:.1f} {ey:.1f}"
                   f"Q{c2[0]:.1f} {c2[1]:.1f} {x:.1f} {y:.1f}Z",
                   f"M{x:.1f} {y:.1f}L{x + math.cos(a) * L * 0.8:.1f} {y + math.sin(a) * L * 0.8:.1f}"))

# A few glowing berries
berries = []
for i in (58, 148):
    x, y, nx, ny, tx, ty, t = pts[i]
    for k in range(3):
        bx = x - nx * (8 + k * 3) + tx * (k - 1) * 5
        by = y - ny * (8 + k * 3) + ty * (k - 1) * 5
        berries.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{2.6 - k * 0.3:.1f}"/>')

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
       f'<path d="{twist}" fill="none" stroke="{STEM}" stroke-width="1.8" stroke-linecap="round"/>'
       f'<g fill="none" stroke="{STEM}" stroke-width="1.6" stroke-linecap="round">'
       + "".join(f'<path d="{d}"/>' for d in tendrils) + '</g>'
       + f'<g fill="{LEAF}">' + "".join(f'<path d="{a}"/>' for a, _ in leaves) + '</g>'
       + f'<g stroke="{LEAF_VEIN}" stroke-width="0.9" fill="none">' + "".join(f'<path d="{b}"/>' for _, b in leaves) + '</g>'
       + f'<path d="{ribbon}" fill="{STEM}"/>'
       + f'<path d="{hilite}" fill="none" stroke="{STEM_HI}" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>'
       + f'<g fill="{THORN}">' + "".join(f'<path d="{d}"/>' for d in thorns) + '</g>'
       + f'<g fill="{BERRY}">' + "".join(berries) + '</g>'
       + '</svg>')
open(out, "w").write(svg)
