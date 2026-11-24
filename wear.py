"""GradeWise wear checker v0.1: whitening on corners and edges, measured with code.

    python wear.py --front front.jpg --back back.jpg --out results/

Whitening is where the coloured ink has worn off the card edge and the white
paper core shows. It is a colour question, so like centering we measure it
instead of asking an AI to judge it.

How it works
1. Find and straighten the card exactly like centering.py (63 x 88 mm at 20 px/mm).
2. Draw the ideal card outline (3 mm rounded corners) and, for every pixel,
   compute how deep inside the card it is.
3. Learn the border ink colour along each side in short 4 mm segments (median
   of the strip 0.4-1.4 mm in from the edge), so uneven lighting and gradient
   borders don't matter. Segments where the ink isn't a flat colour (artwork,
   holo, a border too thin) or is already near white are marked unmeasurable.
4. A pixel within 1.5 mm of the edge counts as whitened when it has moved at
   least 40% of the way from the local ink colour toward white, in roughly
   that direction (not just a different colour). On bright, colourful inks
   (yellow) it must also have lost at least 60% of the ink's colour: a paler
   yellow from sheen or JPEG colour blur at the edge is not paper white.
5. Keep only whitened spots that touch the card outline: real wear starts at
   the edge, white print details further in don't count.
6. Report per corner (4 x 4 mm zones) the whitened area in mm^2, and per edge
   the length of edge that shows whitening. wear_standards.py turns those
   into a PSA ceiling (provisional thresholds).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import asdict, dataclass, field

import cv2
import numpy as np

from centering import CARD_W_MM, MARGIN, PPM, H, W, locate_card, quality_warnings, straighten
from wear_standards import CORNER_LEVELS, EDGE_LEVELS, corners_cap, edges_cap, level

CORNER_RADIUS_MM = 3.0     # Pokemon / MTG / most sports cards
CORNER_MM = 4.0            # corner zone: within 4 mm of both adjacent sides
BAND_MM = 1.5              # how deep into the card we look for whitening
REF_MM = (0.4, 1.4)        # where the border ink colour is sampled
SEGMENT_MM = 4.0           # ink colour is learned per segment of this length
WHITE_LAB = np.array([242, 128, 128], np.float32)   # paper white in OpenCV 8-bit Lab
WHITE_T = 0.4              # share of the way from ink to white a pixel must have moved
CHROMA_LOSS_T = 0.6        # bright, colourful inks (yellow): share of the ink's chroma that must be gone
MIN_CONTRAST = 40.0       # ink closer to white than this: whitening can't be seen
MIN_MEASURABLE = 0.7       # share of a zone that must have a usable ink reference

SIDES = ("top", "right", "bottom", "left")
CORNERS = ("top-left", "top-right", "bottom-right", "bottom-left")


@dataclass
class Zone:
    name: str                  # "top-left" ... or "top", "right", ...
    kind: str                  # "corner" or "edge"
    area_mm2: float            # whitened area
    length_mm: float           # edges: length of edge showing whitening
    max_depth_mm: float        # deepest whitened pixel, measured from the card outline
    level: str                 # clean / tiny / minor / slight / moderate / heavy / unknown
    measurable: bool


@dataclass
class WearResult:
    side: str
    corners: list[Zone]
    edges: list[Zone]
    corners_max_grade: int
    edges_max_grade: int
    max_grade: int             # lower of the two
    reliable: bool
    warnings: list[str] = field(default_factory=list)


# ------------------------------------------------------------ geometry --

def _card_geometry(fh: int, fw: int):
    """Depth (mm) of every pixel inside the ideal rounded card outline, plus helpers."""
    x0, y0, x1, y1 = MARGIN, MARGIN, MARGIN + W - 1, MARGIN + H - 1
    r = int(round(CORNER_RADIUS_MM * PPM))
    card = np.zeros((fh, fw), np.uint8)
    cv2.rectangle(card, (x0 + r, y0), (x1 - r, y1), 255, -1)
    cv2.rectangle(card, (x0, y0 + r), (x1, y1 - r), 255, -1)
    for cx, cy in [(x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)]:
        cv2.circle(card, (cx, cy), r, 255, -1)
    depth = cv2.distanceTransform(card, cv2.DIST_L2, 5) / PPM
    outside = cv2.distanceTransform(255 - card, cv2.DIST_L2, 5) / PPM

    # Compact types and broadcasting instead of full int64 grids: this runs on a
    # 2.6 Mpx image and was the bulk of the engine's memory (512 MB hosts crashed).
    yy = np.arange(fh, dtype=np.int32)[:, None]
    xx = np.arange(fw, dtype=np.int32)[None, :]
    # nearest straight side: top, right, bottom, left; on a tie the earlier one wins
    nearest = np.broadcast_to(yy - y0, (fh, fw)).copy()
    side_idx = np.zeros((fh, fw), np.uint8)
    for i, d in enumerate((x1 - xx, y1 - yy, xx - x0), start=1):
        closer = d < nearest
        side_idx[closer] = i
        np.minimum(nearest, d, out=nearest)
    del nearest
    pos = np.where(side_idx % 2 == 0, xx - x0, yy - y0)                  # position along the side

    cz = CORNER_MM * PPM
    left, right, top, bottom = xx < x0 + cz, xx > x1 - cz, yy < y0 + cz, yy > y1 - cz
    corners = dict(zip(CORNERS, (top & left, top & right, bottom & right, bottom & left)))
    # where the outline curves: the real radius varies a little between cards
    arc = ((xx < x0 + r) | (xx > x1 - r)) & ((yy < y0 + r) | (yy > y1 - r))
    return depth, outside, side_idx, pos, corners, arc


def _ink_reference(lab, depth, side_idx, pos, work, arc, bg):
    """Median border ink per side segment. Returns (ref colour per pixel, usable mask).

    Background must not count as ink. Near the corners the real edge drifts a
    little inside the straight outline (lens distortion, the corner's own shape),
    so the sample strip there can be a third background; that made a plain
    border look "not a flat colour". So: no samples on the corner curve, and
    sample pixels that look more like the background than the ink are dropped."""
    ref = np.zeros_like(lab)
    ok = np.zeros(depth.shape, bool)
    seg = (pos // (SEGMENT_MM * PPM)).astype(np.int32)
    sample = (depth >= REF_MM[0]) & (depth <= REF_MM[1]) & ~arc
    deep = depth >= 0.5 * (REF_MM[0] + REF_MM[1])          # inner half: least background
    for s in range(4):
        on = side_idx == s
        inks, unsampled = {}, []
        for k in np.unique(seg[on & work]):
            sel = on & (seg == k) & sample
            px = lab[sel]
            if len(px) >= 50:
                inner = px[deep[sel]]
                ink0 = np.median(inner if len(inner) >= 20 else px, axis=0)
                px = px[np.linalg.norm(px - ink0, axis=1) < np.linalg.norm(px - bg, axis=1)]
            if len(px) < 50:
                unsampled.append(k)          # (almost) all on the curve: borrow below
                continue
            m = np.median(px, axis=0)
            spread = np.median(np.linalg.norm(px - m, axis=1))
            if spread > 12 or np.linalg.norm(WHITE_LAB - m) < MIN_CONTRAST:
                continue                     # artwork / holo / thin border, or ink already near white
            inks[k] = m
        for k in unsampled:                  # nothing to sample, not bad ink: use the neighbour's
            near = [j for j in (k - 1, k + 1) if j in inks]
            if near:
                inks[k] = inks[near[0]]
        for k, m in inks.items():
            zone = on & (seg == k)
            ref[zone] = m
            ok[zone] = True
    return ref, ok


def _whitish(lab, ref):
    """Pixels that moved at least 40% of the way from the ink colour toward white.

    For bright, colourful inks (yellow: the ink is already nearly as light as
    paper, so the step to white is mostly a loss of colour) that isn't enough.
    A paler yellow keeps its hue and loses only part of its colour: light
    falloff, sheen on the cut edge, and above all JPEG colour blur, which stores
    colour at lower resolution than brightness, so along a dark background the
    outermost border pixels keep full brightness but only about half their
    colour. Paper white is nearly grey, so for these inks a pixel must also have
    lost at least CHROMA_LOSS_T of the ink's chroma, and not be clearly darker
    than the ink (that is a blend with a dark background, not paper)."""
    d = WHITE_LAB - ref
    c2 = (d ** 2).sum(-1) + 1e-6
    rel = lab - ref
    t = (rel * d).sum(-1) / c2
    perp = np.linalg.norm(rel - t[..., None] * d, axis=-1)
    white = (t >= WHITE_T) & (perp <= 0.5 * np.sqrt(c2))
    ink_chroma = np.hypot(ref[..., 1] - 128, ref[..., 2] - 128)
    chroma = np.hypot(lab[..., 1] - 128, lab[..., 2] - 128)
    colourful = ink_chroma > WHITE_LAB[0] - ref[..., 0]       # step to white is mostly colour
    lost = 1 - chroma / np.maximum(ink_chroma, 1)
    lighter = lab[..., 0] >= ref[..., 0] - 10                 # paper is lighter than yellow ink
    return white & (~colourful | ((lost >= CHROMA_LOSS_T) & lighter))


# ------------------------------------------------------------ analysis --

def analyse_wear(img: np.ndarray, side: str = "front", cropped: bool = False):
    """Measure whitening on one side. Returns (WearResult, annotated image, corner zoom image)."""
    img, quad = locate_card(img, cropped)
    flat = straighten(img, quad)
    src_ppm = min(np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[3] - quad[0])) / CARD_W_MM
    src_px_mm = 1.0 / src_ppm                                         # one photo pixel, in mm

    fh, fw = flat.shape[:2]
    lab = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB).astype(np.float32)
    depth, outside, side_idx, pos, corner_masks, arc = _card_geometry(fh, fw)
    work = (depth > 0) & (depth <= BAND_MM)
    bg = np.median(lab[(outside > 0.3) & (outside < 2.0)], axis=0)
    ref, ok = _ink_reference(lab, depth, side_idx, pos, work, arc, bg)
    warnings = quality_warnings(img, quad, flat)

    # A light background blends with the ink along the outline and looks like
    # whitening. Then we skip the blended pixels and say the result is weak.
    skip_mm = 0.0
    if ok.any():
        ink = np.median(ref[ok], axis=0)
        d = WHITE_LAB - ink
        if np.dot(bg - ink, d) / np.dot(d, d) >= 0.4:
            skip_mm = 2.5 * src_px_mm
            warnings.append("Light background: thin whitening can't be told apart from the "
                            "background. Retake on a dark, plain surface.")

    # Only the strip along the edge is ever used: test just those pixels (about
    # 7% of the card) instead of building full-image temporaries in _whitish.
    white = work & ok & (depth > skip_mm)
    white[white] = _whitish(lab[white], ref[white])

    # keep spots that start at the outline and are bigger than ~2 photo pixels
    n, labels, stats, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=8)
    touch = white & (depth <= skip_mm + max(0.15, 1.5 * src_px_mm))
    keep = np.zeros(n, bool)
    keep[np.unique(labels[touch])] = True
    keep[0] = False
    keep &= stats[:, cv2.CC_STAT_AREA] >= max(4.0, 2 * (PPM * src_px_mm) ** 2)
    wear = keep[labels] & white

    any_corner = np.logical_or.reduce(list(corner_masks.values()))
    zones = [(name, "corner", m) for name, m in corner_masks.items()]
    zones += [(name, "edge", (side_idx == i) & ~any_corner) for i, name in enumerate(SIDES)]
    corners, edges = [], []
    for name, kind, mask in zones:
        zw = wear & mask
        in_band = work & mask
        measurable = (ok & in_band).sum() / max(1, in_band.sum()) >= MIN_MEASURABLE
        area = float(zw.sum()) / PPM ** 2
        length = len(np.unique(pos[zw])) / PPM if kind == "edge" else 0.0
        if not measurable:
            lvl = "unknown"
            warnings.append(f"{name} {kind}: border isn't a flat colour (or is too light) "
                            "near the edge, whitening not measured.")
        else:
            lvl = level(area, CORNER_LEVELS) if kind == "corner" else level(length, EDGE_LEVELS)
        z = Zone(name, kind, round(area, 3), round(length, 1),
                 round(float(depth[zw].max()) if zw.any() else 0.0, 2), lvl, bool(measurable))
        (corners if kind == "corner" else edges).append(z)

    c_cap = corners_cap([z.level for z in corners if z.measurable])
    e_cap = edges_cap([z.level for z in edges if z.measurable])
    result = WearResult(side, corners, edges, c_cap, e_cap, min(c_cap, e_cap),
                        reliable=not warnings, warnings=warnings)
    return result, annotate(flat, wear, result), corner_zoom(flat, wear)


# ---------------------------------------------------------- annotation --

LEVEL_BGR = {"clean": (60, 170, 60), "tiny": (0, 190, 240), "minor": (0, 190, 240),
             "slight": (0, 130, 255), "moderate": (0, 0, 230), "heavy": (0, 0, 160),
             "unknown": (150, 150, 150)}
WEAR_BGR = (255, 0, 255)


def annotate(flat: np.ndarray, wear: np.ndarray, r: WearResult) -> np.ndarray:
    out = flat.copy()
    out[wear] = WEAR_BGR
    x0, y0, x1, y1 = MARGIN, MARGIN, MARGIN + W - 1, MARGIN + H - 1
    cz, g = int(CORNER_MM * PPM), 8          # g: gap between the card and the edge bars
    bars = {"top": ((x0 + cz, y0 - g), (x1 - cz, y0 - g)), "bottom": ((x0 + cz, y1 + g), (x1 - cz, y1 + g)),
            "left": ((x0 - g, y0 + cz), (x0 - g, y1 - cz)), "right": ((x1 + g, y0 + cz), (x1 + g, y1 - cz))}
    for z in r.edges:
        cv2.line(out, *bars[z.name], LEVEL_BGR[z.level], 6)
    boxes = {"top-left": (x0, y0), "top-right": (x1 - cz, y0),
             "bottom-right": (x1 - cz, y1 - cz), "bottom-left": (x0, y1 - cz)}
    for z in r.corners:
        bx, by = boxes[z.name]
        cv2.rectangle(out, (bx - g, by - g), (bx + cz + g, by + cz + g), LEVEL_BGR[z.level], 3)
    font = cv2.FONT_HERSHEY_SIMPLEX
    lines = [f"{r.side.upper()} WEAR   corners: PSA {r.corners_max_grade}   edges: PSA {r.edges_max_grade}",
             f"Whitening allows up to PSA {r.max_grade} (provisional)"]
    header = np.full((50 * len(lines) + 25, out.shape[1], 3), 25, np.uint8)
    for i, text in enumerate(lines):
        cv2.putText(header, text, (20, 45 + 50 * i), font, 1.1, (255, 255, 255), 2, cv2.LINE_AA)
    return np.vstack([header, out])


def corner_zoom(flat: np.ndarray, wear: np.ndarray, mm: float = 6.0, zoom: int = 3) -> np.ndarray:
    """2 x 2 grid of the four corners, enlarged, with detected whitening outlined."""
    s = int(mm * PPM)
    pad = int(1.0 * PPM)                    # show a little background around the corner
    x0, y0, x1, y1 = MARGIN - pad, MARGIN - pad, MARGIN + W + pad, MARGIN + H + pad
    origins = [(x0, y0), (x1 - s, y0), (x0, y1 - s), (x1 - s, y1 - s)]
    names = ["top-left", "top-right", "bottom-left", "bottom-right"]
    tiles = []
    for (ox, oy), name in zip(origins, names):
        crop = cv2.resize(flat[oy:oy + s, ox:ox + s], None, fx=zoom, fy=zoom, interpolation=cv2.INTER_CUBIC)
        m = cv2.resize(wear[oy:oy + s, ox:ox + s].astype(np.uint8), None, fx=zoom, fy=zoom,
                       interpolation=cv2.INTER_NEAREST)
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(crop, contours, -1, WEAR_BGR, 2)
        cv2.putText(crop, name, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
        tiles.append(crop)
    gap = np.full((tiles[0].shape[0], 6, 3), 255, np.uint8)
    rows = [np.hstack([tiles[0], gap, tiles[1]]), np.hstack([tiles[2], gap, tiles[3]])]
    return np.vstack([rows[0], np.full((6, rows[0].shape[1], 3), 255, np.uint8), rows[1]])


# ------------------------------------------------------------------- CLI --

def main(argv=None):
    ap = argparse.ArgumentParser(description="GradeWise: whitening on corners and edges")
    ap.add_argument("--front", required=True, help="photo of the card front")
    ap.add_argument("--back", required=True, help="photo of the card back")
    ap.add_argument("--out", default="results", help="folder for annotated images + JSON")
    ap.add_argument("--cropped", action="store_true", help="images are already tightly cropped scans")
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    report = {}
    for side in ("front", "back"):
        img = cv2.imread(getattr(args, side))
        if img is None:
            sys.exit(f"Cannot read {getattr(args, side)}")
        try:
            res, vis, zoom = analyse_wear(img, side, args.cropped)
        except ValueError as e:
            sys.exit(f"{side}: {e}")
        cv2.imwrite(os.path.join(args.out, f"{side}_wear.jpg"), vis)
        cv2.imwrite(os.path.join(args.out, f"{side}_corners.jpg"), zoom)
        report[side] = asdict(res)
        print(f"{side:>5}: corners -> PSA {res.corners_max_grade}, edges -> PSA {res.edges_max_grade}"
              f"{'' if res.reliable else '  [UNRELIABLE - retake photo]'}")
        for z in res.corners + res.edges:
            print(f"       {z.name:<13} {z.level:<8} area {z.area_mm2:.2f} mm2"
                  + (f"  length {z.length_mm:.1f} mm" if z.kind == "edge" else ""))
        for w in res.warnings:
            print(f"       ! {w}")
    report["wear_max_grade"] = min(report[s]["max_grade"] for s in ("front", "back"))
    with open(os.path.join(args.out, "wear.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(f"Whitening allows at most PSA {report['wear_max_grade']} (provisional). Saved to {args.out}/")


if __name__ == "__main__":
    main()
