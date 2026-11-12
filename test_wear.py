"""Accuracy test: python test_wear.py

Paints whitening of KNOWN size on the corners and edges of fake cards, turns
them into phone-like photos (tilt, perspective, blur, noise, uneven light,
JPEG) and checks that wear.py
(a) finds nothing on clean cards,
(b) measures corner area and edge length close to the truth,
(c) puts every zone in the right level, or at most one level off.
Some cards also get a pale-yellow sheen along an edge (the border colour mixed
partly toward white, like light catching the cut edge). That is not wear and
must not be reported.
"""
import cv2
import numpy as np

from make_test_cards import H, PPM, W, card_face, photo
from wear import CORNER_MM, CORNERS, SIDES, analyse_wear
from wear_standards import CORNER_LEVELS, EDGE_LEVELS, WORST, level

YELLOW, BLUE = (40, 200, 240), (160, 90, 30)
PAPER = (238, 240, 240)

# (border colour, card px, [wear spots]); spot = ("corner", name, depth mm, size mm)
#                                          or ("edge", name, depth mm, start mm, length mm)
#                                          or ("sheen", name, depth mm, share of the way to white)
CASES = [
    (YELLOW, 1500, []),
    (BLUE, 1500, []),
    (YELLOW, 1000, []),
    (BLUE, 1100, []),
    (YELLOW, 1500, [("corner", "top-left", 0.3, 2.0)]),
    (BLUE, 1500, [("corner", "top-right", 0.2, 1.5), ("corner", "bottom-left", 0.2, 1.5)]),
    (BLUE, 1500, [("corner", "bottom-right", 0.8, 3.5), ("edge", "left", 0.3, 20, 12)]),
    (BLUE, 1200, [("edge", "top", 0.2, 15, 6), ("edge", "bottom", 0.15, 30, 2)]),
    (YELLOW, 1500, [("edge", "right", 0.25, 40, 8), ("corner", "top-left", 0.5, 3.0)]),
    (BLUE, 1800, [("corner", "top-left", 0.15, 1.0), ("edge", "right", 0.12, 50, 4)]),
    (YELLOW, 1500, [("sheen", "left", 0.3, 0.45), ("sheen", "bottom", 0.2, 0.4)]),
    (YELLOW, 750, [("sheen", "right", 0.25, 0.45)]),          # eBay-size photo, ~12 px/mm
    (YELLOW, 1200, [("sheen", "left", 0.3, 0.45), ("edge", "right", 0.25, 30, 10)]),
]


def paint_wear(face, alpha, spots, rng):
    """Paint paper-white wear along the outline. Returns true area/length per zone."""
    inside = cv2.copyMakeBorder((alpha > 0).astype(np.uint8), 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    depth = cv2.distanceTransform(inside, cv2.DIST_L2, 5)[1:-1, 1:-1] / PPM   # image border = card edge
    yy, xx = np.mgrid[0:H, 0:W]
    cz = CORNER_MM * PPM
    corner_box = {"top-left": (xx < cz) & (yy < cz), "top-right": (xx >= W - cz) & (yy < cz),
                  "bottom-right": (xx >= W - cz) & (yy >= H - cz), "bottom-left": (xx < cz) & (yy >= H - cz)}
    any_corner = np.logical_or.reduce(list(corner_box.values()))
    nearest = np.stack([yy, W - 1 - xx, H - 1 - yy, xx]).argmin(0)        # top, right, bottom, left
    on_side = {name: nearest == i for i, name in enumerate(SIDES)}
    truth = {n: 0.0 for n in CORNERS + SIDES}
    for spot in spots:
        # ragged inner boundary, like real fraying
        wobble = cv2.resize(rng.uniform(0.5, 1.2, (H // 40, W // 40)), (W, H), interpolation=cv2.INTER_CUBIC)
        if spot[0] == "sheen":                # pale border colour along a whole side, not paper
            _, name, d, mix = spot
            m = on_side[name] & ~any_corner & (alpha > 0) & (depth <= d)
            face[m] = ((1 - mix) * face[m] + mix * 255).astype(np.uint8)
            continue
        if spot[0] == "corner":
            _, name, d, size = spot
            cx = 0 if "left" in name else W
            cy = 0 if "top" in name else H
            m = (np.abs(xx - cx) < size * PPM) & (np.abs(yy - cy) < size * PPM)
        else:
            _, name, d, start, length = spot
            p = xx if name in ("top", "bottom") else yy
            m = (p >= start * PPM) & (p < (start + length) * PPM) & ~any_corner & on_side[name]
        m &= (alpha > 0) & (depth <= d * wobble)
        face[m] = PAPER
    white = np.all(face == PAPER, axis=2) & (alpha > 0)
    for name, box in corner_box.items():
        truth[name] = (white & box).sum() / PPM ** 2
    for name in SIDES:
        side_m = white & ~any_corner & on_side[name] & (depth < 2)
        along = xx if name in ("top", "bottom") else yy
        truth[name] = len(np.unique(along[side_m])) / PPM
    return truth


def main():
    rng = np.random.default_rng(11)
    rows, false_pos, far_off, area_err, len_err = [], 0, 0, [], []
    for colour, px, spots in CASES:
        face, alpha, _ = card_face(52, 50, rng, border_bgr=colour)
        truth = paint_wear(face, alpha, spots, rng)
        img = photo(face, alpha, rng, card_width_px=px)
        res, _, _ = analyse_wear(img, "front")
        got = {z.name: z for z in res.corners + res.edges}
        for name in CORNERS + SIDES:
            z, t = got[name], truth[name]
            if z.kind == "corner":
                t_lvl, val = level(t, CORNER_LEVELS), z.area_mm2
                if t > 0:
                    area_err.append(abs(val - t) / t)
            else:
                t_lvl, val = level(t, EDGE_LEVELS), z.length_mm
                if t > 0:
                    len_err.append(abs(val - t) / t)
            scale = [n for _, n in (CORNER_LEVELS if z.kind == "corner" else EDGE_LEVELS)] + [WORST]
            off = abs(scale.index(z.level) - scale.index(t_lvl))
            if t == 0 and val > 0:
                false_pos += 1
            if off > 1:
                far_off += 1
            if t > 0 or val > 0:
                unit = "mm2" if z.kind == "corner" else "mm"
                rows.append(f"{'blue' if colour == BLUE else 'yellow':>6} {px}px  {name:<13} "
                            f"true {t:6.2f} {unit:<3} ({t_lvl:<8})  measured {val:6.2f} ({z.level})")
        if all(s[0] == "sheen" for s in spots):
            rows.append(f"{'blue' if colour == BLUE else 'yellow':>6} {px}px  clean card: "
                        f"{'(with sheen) ' if spots else ''}{'all clean' if all(z.level == 'clean' for z in got.values()) else 'FALSE WEAR'}")

    print("\n".join(rows))
    print(f"\ncorner area error: median {100 * np.median(area_err):.0f}%, max {100 * np.max(area_err):.0f}%")
    print(f"edge length error: median {100 * np.median(len_err):.0f}%, max {100 * np.max(len_err):.0f}%")
    print(f"false whitening on clean zones: {false_pos}, levels off by more than one: {far_off}")
    assert false_pos == 0, "whitening reported where there is none"
    assert far_off == 0, "a zone landed more than one level away from the truth"
    print("PASS")


if __name__ == "__main__":
    main()
