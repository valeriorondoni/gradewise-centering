"""GradeWise centering checker v0.1

Takes a phone photo (or scan) of a trading card, finds the card, straightens
it, measures the four borders and tells you the highest PSA grade the
centering allows.

    python centering.py --front front.jpg --back back.jpg --out results/

How it works
1. Find the card outline (brightness AND colour edges), fit a straight line
   to each side, and step outward if we locked onto the printed frame instead.
2. Undo the perspective so the card becomes a flat 63 x 88 mm rectangle at
   20 px/mm, then polish the corners by re-fitting the edges in that image.
3. Along ~100 scanlines per side, find the outer edge (colour jump at the card
   edge) and the inner edge (first point where the border colour ends),
   both to sub-pixel precision.
4. Border width = trimmed mean over scanlines. Ratio = wider / (both sides).
5. Compare with PSA's limits (psa_standards.py), estimate how sure we are,
   and flag photos we shouldn't trust (low resolution, blur, glare, missed edge).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from dataclasses import asdict, dataclass, field

import cv2
import numpy as np

from psa_standards import centering_cap, limit_for

CARD_W_MM, CARD_H_MM = 63.0, 88.0  # Pokemon / MTG / sports cards are all ~63x88
PPM = 20                            # pixels per mm in the straightened image
W, H = int(CARD_W_MM * PPM), int(CARD_H_MM * PPM)
MARGIN = 3 * PPM                    # background kept around the card after warping


# ----------------------------------------------------------------- results --

@dataclass
class SideResult:
    side: str                       # "front" or "back"
    left_mm: float
    right_mm: float
    top_mm: float
    bottom_mm: float
    left_right: str                 # e.g. "52/48"
    top_bottom: str
    worst_axis: str                 # "left/right" or "top/bottom"
    worst_pct: float                # wider border share on the worse axis
    uncertainty_pct: float          # 1 sigma measurement uncertainty on worst_pct
    max_grade: int                  # highest PSA grade centering allows
    max_grade_name: str
    chance_centering_ok_for_10: float  # P(true centering within the PSA 10 limit)
    borderline: bool
    reliable: bool                  # False = don't feed this into a grading decision
    warnings: list[str] = field(default_factory=list)


# --------------------------------------------------------- card detection --

def _order(pts: np.ndarray) -> np.ndarray:
    """Return corners as top-left, top-right, bottom-right, bottom-left."""
    pts = pts.reshape(-1, 2).astype(np.float32)
    s, d = pts.sum(1), pts[:, 1] - pts[:, 0]
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]],
                    dtype=np.float32)


def _candidate_masks(small: np.ndarray):
    """Several ways of separating card from background.

    Edges are found on colour as well as brightness: a blue Pokemon back on a
    grey desk has almost the same brightness as the desk.
    """
    k = np.ones((5, 5), np.uint8)
    blur = cv2.GaussianBlur(small, (5, 5), 0)
    lab = cv2.cvtColor(blur, cv2.COLOR_BGR2LAB)
    for i, gain in ((0, 1.0), (1, 2.5), (2, 2.5)):
        ch = cv2.convertScaleAbs(lab[..., i], alpha=gain, beta=-128 * (gain - 1))
        yield cv2.morphologyEx(cv2.Canny(ch, 30, 90), cv2.MORPH_CLOSE, k, iterations=3)
    gray = cv2.cvtColor(blur, cv2.COLOR_BGR2GRAY)
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    yield cv2.morphologyEx(otsu, cv2.MORPH_OPEN, k, iterations=2)
    yield cv2.morphologyEx(255 - otsu, cv2.MORPH_OPEN, k, iterations=2)
    yield _background_mask(small)


def _background_mask(small: np.ndarray) -> np.ndarray:
    """Everything whose colour differs from the background, learned from the photo's border.

    A dark blue Pokemon back on black cloth is close to the cloth in brightness,
    so the edge masks merge the card with the cloth's folds and Otsu splits the
    card's bright artwork from its dark border instead. The background itself is
    uniform, though: anything that isn't background-coloured is the card.
    """
    lab = cv2.cvtColor(cv2.GaussianBlur(small, (7, 7), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
    h, w = lab.shape[:2]
    b = max(4, int(0.03 * min(h, w)))
    ring = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3),
                           lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    spread = np.percentile(np.linalg.norm(ring - bg, axis=1), 90)     # how much the background varies
    dist = np.linalg.norm((lab - bg) * [1.0, 2.0, 2.0], axis=2)       # colour counts more than brightness
    mask = (dist > max(12.0, 1.5 * spread)).astype(np.uint8) * 255
    k = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k, iterations=2)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k, iterations=4)


def find_card(img: np.ndarray) -> np.ndarray | None:
    """Find the card's four corners (full-resolution pixel coordinates).

    Every mask can propose quadrilaterals; we keep the LARGEST card-shaped one,
    so the printed frame inside the card can never win over the card itself.
    """
    h, w = img.shape[:2]
    scale = min(1.0, 1200 / max(h, w))
    small = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    area_img = small.shape[0] * small.shape[1]

    mag = _edge_magnitude(small)
    best, best_area = None, 0.0
    for mask in _candidate_masks(small):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
            area = cv2.contourArea(c)
            if area < 0.03 * area_img or area > 0.98 * area_img or area <= best_area:
                continue
            hull = cv2.convexHull(c)
            approx = cv2.approxPolyDP(hull, 0.03 * cv2.arcLength(hull, True), True)
            if len(approx) != 4:
                continue
            if area / cv2.contourArea(approx) < 0.85:      # must fill its own quad
                continue
            q = _order(approx)
            sides = [np.linalg.norm(q[i] - q[(i + 1) % 4]) for i in range(4)]
            short, long_ = sorted([(sides[0] + sides[2]) / 2, (sides[1] + sides[3]) / 2])
            if not 0.55 < short / long_ < 0.9:              # cards are 63/88 = 0.72
                continue
            # every side must sit on a real edge (rejects outlines merged with desk texture)
            q = _refine_with_lines(c.reshape(-1, 2).astype(np.float32), q)
            if _edge_support(mag, q) < 0.7:
                continue
            best, best_area = q, area
    if best is None:
        return None
    quad = _expand_if_inner_frame(img, best / scale)
    return _refine_in_flat(img, quad)


def _edge_magnitude(small: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(cv2.GaussianBlur(small, (5, 5), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
    mag = np.zeros(small.shape[:2], np.float32)
    for i, gain in ((0, 1.0), (1, 2.0), (2, 2.0)):
        gx = cv2.Sobel(lab[..., i], cv2.CV_32F, 1, 0)
        gy = cv2.Sobel(lab[..., i], cv2.CV_32F, 0, 1)
        mag = np.maximum(mag, gain * cv2.magnitude(gx, gy))
    # tolerate ~6 px misplacement (the outline sits slightly outside the edge),
    # and express strength relative to the strongest edges in the photo
    mag = cv2.dilate(mag, np.ones((13, 13), np.uint8))
    return mag / max(1.0, float(np.percentile(mag, 99)))


def _edge_support(mag: np.ndarray, q: np.ndarray) -> float:
    """Worst side: share of points along that side lying on a strong edge."""
    h, w = mag.shape
    worst = 1.0
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        pts = a + np.linspace(0.1, 0.9, 60)[:, None] * (b - a)
        xs = np.clip(pts[:, 0].round().astype(int), 0, w - 1)
        ys = np.clip(pts[:, 1].round().astype(int), 0, h - 1)
        worst = min(worst, float(np.mean(mag[ys, xs] > 0.25)))
    return worst


def _expand_if_inner_frame(img: np.ndarray, quad: np.ndarray, max_mm: float = 6.0,
                           rounds: int = 2) -> np.ndarray:
    """If we locked onto the printed frame instead of the card edge, step outward.

    Straighten with a wide margin and look outside each side for a second straight
    edge parallel to it, with a band of uniform colour in between (= the border).
    Only expand if all four sides show one: a real card border goes all the way round.
    """
    m2 = int(max_mm * PPM) + 20
    for _ in range(rounds):
        dst = np.array([[m2, m2], [m2 + W, m2], [m2 + W, m2 + H], [m2, m2 + H]], np.float32)
        q = quad
        if np.linalg.norm(q[1] - q[0]) > np.linalg.norm(q[3] - q[0]):
            q = np.roll(q, -1, axis=0)
        m = cv2.getPerspectiveTransform(q.astype(np.float32), dst)
        flat = cv2.warpPerspective(img, m, (W + 2 * m2, H + 2 * m2), flags=cv2.INTER_LINEAR,
                                   borderMode=cv2.BORDER_REPLICATE)
        lab = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB).astype(np.float32)
        rows = slice(m2 + int(0.2 * H), m2 + int(0.8 * H))
        cols = slice(m2 + int(0.2 * W), m2 + int(0.8 * W))
        strips = {  # (n_lines, distance outward from current edge, 3); index 0 = current edge
            "left": lab[rows, m2 + 4::-1][:, :m2],
            "right": lab[rows, m2 + W - 4:][:, :m2],
            "top": lab[m2 + 4::-1, cols][:m2].transpose(1, 0, 2),
            "bottom": lab[m2 + H - 4:, cols][:m2].transpose(1, 0, 2),
        }
        offsets = {}
        for side, st in strips.items():
            g = np.linalg.norm(st[:, 4:] - st[:, :-4], axis=2).mean(0)   # line-averaged gradient
            g = np.concatenate([[0, 0], g, [0, 0]])
            d = 15 + int(np.argmax(g[15:-5]))
            floor = float(np.median(g[15:]))
            if g[d] < max(6.0, 4.0 * floor):          # no clear straight edge further out
                break
            band = st[:, 6:d - 4].reshape(-1, 3)
            if len(band) == 0 or np.median(np.linalg.norm(band - np.median(band, 0), axis=1)) > 12:
                break
            offsets[side] = d - 4
        if len(offsets) < 4:
            return quad
        rect = np.array([[m2 - offsets["left"], m2 - offsets["top"]],
                         [m2 + W + offsets["right"], m2 - offsets["top"]],
                         [m2 + W + offsets["right"], m2 + H + offsets["bottom"]],
                         [m2 - offsets["left"], m2 + H + offsets["bottom"]]], np.float32)
        quad = cv2.perspectiveTransform(rect[None], np.linalg.inv(m))[0]
    return quad


def _refine_with_lines(contour: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Fit a straight line to each side (ignoring rounded corners), then intersect.

    approxPolyDP cuts the rounded corners, which skews the perspective a little.
    Fitting each side on its middle section and intersecting gives the true
    corner of the (virtual) sharp-cornered rectangle.
    """
    lines = []
    for i in range(4):
        a, b = quad[i], quad[(i + 1) % 4]
        ab = b - a
        length = np.linalg.norm(ab)
        t = ((contour - a) @ ab) / (length ** 2)            # position along side
        rel = contour - a
        dist = np.abs(ab[0] * rel[:, 1] - ab[1] * rel[:, 0]) / length  # distance from side
        sel = contour[(t > 0.15) & (t < 0.85) & (dist < 0.04 * length)]
        if len(sel) < 10:
            return quad
        vx, vy, x0, y0 = cv2.fitLine(sel, cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
        lines.append((np.array([x0, y0]), np.array([vx, vy])))

    corners = []
    for i in range(4):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        m = np.array([d1, -d2]).T
        if abs(np.linalg.det(m)) < 1e-6:
            return quad
        t = np.linalg.solve(m, p2 - p1)
        corners.append(p1 + t[0] * d1)
    return np.array(corners, dtype=np.float32)


def _refine_in_flat(img: np.ndarray, quad: np.ndarray, rounds: int = 2) -> np.ndarray:
    """Polish the corners: straighten, find the card edge along each side, fit a
    line to it, intersect the four lines, map back to the photo. Repeat."""
    for _ in range(rounds):
        flat, m = _warp(img, quad, MARGIN)
        lab = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB).astype(np.float32)
        lines = []
        for side in ("top", "right", "bottom", "left"):
            grads = _blurred_gradients(_profiles(lab, side, lo=0.1, hi=0.9, step=8))
            pos, edge = _line_positions(side)[:len(grads)], []
            # Work in 6 sections so a tilted first guess still gives sharp medians
            for chunk in np.array_split(np.arange(len(grads)), 6):
                centre = _card_edge_position(np.median(grads[chunk], 0),
                                             MARGIN - 2 * PPM, MARGIN + PPM)
                for i in chunk:
                    e = _nearest_peak(grads[i], centre, 8)
                    edge.append(np.nan if e is None else e)
            edge = np.array(edge)
            keep = np.isfinite(edge)
            if keep.sum() < 10:
                return quad
            k, c = np.polyfit(pos[keep], edge[keep], 1)        # edge offset vs position
            resid = np.abs(edge - (k * pos + c))
            keep &= np.nan_to_num(resid, nan=1e9) < 4              # drop stray lines, refit
            if keep.sum() < 10:
                return quad
            k, c = np.polyfit(pos[keep], edge[keep], 1)
            lines.append((side, k, c))
        # convert "distance inward from the outer frame" lines into image lines
        full_w, full_h = W + 2 * MARGIN, H + 2 * MARGIN
        pts = {}
        for side, k, c in lines:
            if side == "left":
                pts[side] = lambda t, k=k, c=c: (k * t + c, t)
            elif side == "right":
                pts[side] = lambda t, k=k, c=c: (full_w - 1 - (k * t + c), t)
            elif side == "top":
                pts[side] = lambda t, k=k, c=c: (t, k * t + c)
            else:
                pts[side] = lambda t, k=k, c=c: (t, full_h - 1 - (k * t + c))

        def meet(a, b):   # intersect two parametrised lines numerically (both near-straight)
            p1, p2 = np.array(pts[a](0.0)), np.array(pts[a](1000.0))
            q1, q2 = np.array(pts[b](0.0)), np.array(pts[b](1000.0))
            d1, d2 = p2 - p1, q2 - q1
            t = np.linalg.solve(np.array([d1, -d2]).T, q1 - p1)
            return p1 + t[0] * d1

        corners = np.array([meet("top", "left"), meet("top", "right"),
                            meet("bottom", "right"), meet("bottom", "left")], np.float32)
        quad = cv2.perspectiveTransform(corners[None], np.linalg.inv(m))[0]
    return quad


def _warp(img: np.ndarray, quad: np.ndarray, margin: int):
    dst = np.array([[margin, margin], [margin + W, margin],
                    [margin + W, margin + H], [margin, margin + H]], dtype=np.float32)
    q = quad.astype(np.float32)
    if np.linalg.norm(q[1] - q[0]) > np.linalg.norm(q[3] - q[0]):   # keep portrait
        q = np.roll(q, -1, axis=0)
    m = cv2.getPerspectiveTransform(q, dst)
    flat = cv2.warpPerspective(img, m, (W + 2 * margin, H + 2 * margin),
                               flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return flat, m


def straighten(img: np.ndarray, quad: np.ndarray) -> np.ndarray:
    """Warp the card to a flat W x H image with MARGIN of background around it."""
    return _warp(img, quad, MARGIN)[0]


# ------------------------------------------------------ border measurement --

def _profiles(lab: np.ndarray, side: str, lo: float = 0.2, hi: float = 0.8, step: int = 4) -> np.ndarray:
    """Scanlines running from outside the card inward, shape (n_lines, length, 3)."""
    y0, y1 = MARGIN + int(lo * H), MARGIN + int(hi * H)
    x0, x1 = MARGIN + int(lo * W), MARGIN + int(hi * W)
    depth_lr = MARGIN + int(0.3 * W)
    depth_tb = MARGIN + int(0.3 * H)
    if side == "left":
        return lab[y0:y1:step, :depth_lr]
    if side == "right":
        return lab[y0:y1:step, ::-1][:, :depth_lr]
    if side == "top":
        return lab[:depth_tb, x0:x1:step].transpose(1, 0, 2)
    return lab[::-1, x0:x1:step][:depth_tb].transpose(1, 0, 2)  # bottom


def _line_positions(side: str, lo: float = 0.1, hi: float = 0.9, step: int = 8) -> np.ndarray:
    """Pixel coordinate (along the side) of each scanline from _profiles."""
    if side in ("left", "right"):
        return np.arange(MARGIN + int(lo * H), MARGIN + int(hi * H), step, dtype=float)
    return np.arange(MARGIN + int(lo * W), MARGIN + int(hi * W), step, dtype=float)


def _gradient(p: np.ndarray) -> np.ndarray:
    g = np.zeros(len(p))
    g[2:-2] = np.linalg.norm(p[4:] - p[:-4], axis=1)
    return g


def _peak(g: np.ndarray, lo: int, hi: int) -> float:
    """Position of the gradient peak in g[lo:hi], refined to sub-pixel."""
    i = lo + int(np.argmax(g[lo:hi]))
    a, b, c = g[i - 1], g[i], g[i + 1]
    den = a - 2 * b + c
    return i + (0.5 * (a - c) / den if den < 0 else 0.0)


def _blurred_gradients(lines: np.ndarray) -> np.ndarray:
    return np.array([_gradient(cv2.GaussianBlur(p.reshape(-1, 1, 3), (1, 5), 0).reshape(-1, 3))
                     for p in lines])


def _card_edge_position(med: np.ndarray, lo: int, hi: int, rel: float = 0.2) -> int:
    """Card edge on a side, from the median gradient over all its scanlines:
    the INNERMOST clear peak in med[lo:hi].

    Slabs, top-loaders and shadows add edges just outside the card (the bright
    rim of the plastic, a dark gap). Those can be stronger than the card's own
    edge - dark blue against black is a weak jump - so we don't take the
    strongest edge, we take the one furthest in.
    """
    seg = med[lo:hi]
    top = seg.max()
    for k in range(len(seg) - 2, 0, -1):
        if seg[k] >= max(rel * top, 8.0) and seg[k] >= seg[k - 1] and seg[k] >= seg[k + 1]:
            return lo + k
    return lo + int(np.argmax(seg))


def _nearest_peak(g: np.ndarray, centre: int, radius: int) -> float | None:
    """Sub-pixel position of the local gradient peak closest to `centre`.

    Used per scanline after the side-wide position is known. Picking the
    nearest (not the biggest) peak stops a scanline jumping to the far side of
    a thin printed line, which sits a few pixels away.
    """
    lo, hi = max(1, centre - radius), min(len(g) - 1, centre + radius + 1)
    if hi - lo < 3:
        return None
    floor = 0.5 * g[lo:hi].max()
    best = None
    for i in range(lo, hi):
        if g[i] >= floor and g[i] >= g[i - 1] and g[i] >= g[i + 1]:
            if best is None or abs(i - centre) < abs(best - centre):
                best = i
    return None if best is None else _peak(g, best, best + 1)


def _first_strong_peak(m: np.ndarray, lo: int, hi: int, rel: float = 0.4) -> int | None:
    """Index of the first local maximum in m[lo:hi] that is at least `rel` of the
    biggest one and clearly above the background level."""
    seg = m[lo:hi]
    if len(seg) < 3:
        return None
    top, floor = seg.max(), float(np.median(seg))
    need = max(rel * top, 4.0 * floor, 6.0)
    for k in range(1, len(seg) - 1):
        if seg[k] >= need and seg[k] >= seg[k - 1] and seg[k] >= seg[k + 1]:
            return lo + k
    return None


def measure_side(lab: np.ndarray, side: str, ramp: int = 4, max_mm: float = 7.0):
    """Border width in pixels on one side: (mean, standard error, usable share, border colour).

    Both edges are first located on the MEDIAN gradient over all scanlines of
    the side. A printed frame or a card edge is a straight line parallel to the
    side, so it survives; artwork texture, holo sparkle, shading inside the
    border and light rays crossing only some scanlines drop out. (Vintage gold
    borders are shaded; old Japanese backs have a swirl right to the edge and
    a thin red frame line - both work this way.) Each scanline then refines
    the two positions locally, which gives the spread.
    """
    lines = _profiles(lab, side)
    grads = _blurred_gradients(lines)
    med = np.median(grads, axis=0)

    outer_c = _card_edge_position(med, MARGIN - PPM, MARGIN + int(0.8 * PPM))
    lo = outer_c + ramp + 2
    hi = min(len(med) - 12, lo + int(max_mm * PPM))
    inner_c = _first_strong_peak(med, lo, hi, rel=0.15)
    if inner_c is None:
        return None, None, 0.0, None

    widths, bands = [], []
    for g, p in zip(grads, lines):
        o = _nearest_peak(g, outer_c, 5)
        i = _nearest_peak(g, inner_c, 5)
        if o is None or i is None:
            continue                                      # edge not visible on this line
        widths.append(i - o)
        a, b = int(o) + ramp, int(i) - ramp
        if b > a:
            bands.append(np.median(p[a:b], axis=0))

    valid = len(widths) / max(1, len(lines))
    if len(widths) < 10:
        return None, None, valid, None
    w = np.array(widths, dtype=float)
    m = np.median(w)
    mad = 1.4826 * np.median(np.abs(w - m)) + 0.5
    w = w[np.abs(w - m) < 3 * mad + 2]                   # drop outliers
    # neighbouring scanlines are correlated, so count roughly every 4th as independent
    se = w.std() / math.sqrt(max(1, len(w) / 4))
    colour = np.median(np.array(bands), axis=0) if bands else np.zeros(3)
    return float(w.mean()), float(se), valid, colour


# ------------------------------------------------------------- analysis --

def _phi(z: float) -> float:
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def _ratio(a: float, b: float, sa: float, sb: float):
    """Wider-border share in % and its 1-sigma uncertainty."""
    tot = a + b
    pct = 100 * max(a, b) / tot
    sigma = 100 * math.hypot(b * sa, a * sb) / tot ** 2
    return pct, sigma


def _split(a: float, b: float) -> str:
    l = round(100 * a / (a + b))
    return f"{l}/{100 - l}"


def quality_warnings(img: np.ndarray, quad: np.ndarray, flat: np.ndarray) -> list[str]:
    warnings = []
    card_px = min(np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[3] - quad[0]))
    if card_px < 800:
        warnings.append(f"Low resolution: card is only {card_px:.0f} px wide. "
                        "Move closer or use the main camera (aim for 1000+ px).")
    card = flat[MARGIN:MARGIN + H, MARGIN:MARGIN + W]
    small = cv2.resize(cv2.cvtColor(card, cv2.COLOR_BGR2GRAY), (W // 2, H // 2))
    sharp = cv2.Laplacian(small, cv2.CV_64F).var()
    if sharp < 25:   # calibrate this on real phone photos
        warnings.append(f"Photo looks blurry (sharpness {sharp:.0f}). Hold still and refocus.")
    hsv = cv2.cvtColor(card, cv2.COLOR_BGR2HSV)
    glare = float(np.mean((hsv[..., 2] >= 250) & (hsv[..., 1] <= 25)))
    if glare > 0.03:
        warnings.append(f"Possible glare on {glare:.0%} of the card. Avoid direct light.")
    return warnings


def locate_card(img: np.ndarray, cropped: bool = False):
    """Return (image, quad): the image to work on and the card's four corners in it."""
    if cropped:   # already a tight scan: pad it so the card edge is visible
        pad = int(0.05 * max(img.shape[:2]))
        h, w = img.shape[:2]
        img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(20, 20, 20))
        quad = np.array([[pad, pad], [pad + w, pad], [pad + w, pad + h], [pad, pad + h]],
                        dtype=np.float32)
    else:
        quad = find_card(img)
        if quad is None:
            raise ValueError("Could not find the card. Use a plain, contrasting background "
                             "and keep the whole card in frame (or pass --cropped for scans).")
    return img, quad


def analyse(img: np.ndarray, side: str = "front", cropped: bool = False):
    """Measure one side of a card. Returns (SideResult, annotated image)."""
    img, quad = locate_card(img, cropped)
    flat = straighten(img, quad)
    lab = cv2.cvtColor(flat, cv2.COLOR_BGR2LAB).astype(np.float32)

    # The straightened image is 20 px/mm; one source pixel may cover several of them.
    src_px_per_mm = min(np.linalg.norm(quad[1] - quad[0]),
                        np.linalg.norm(quad[3] - quad[0])) / CARD_W_MM
    floor = max(0.5, 0.7 * PPM / src_px_per_mm)           # quantisation floor, in flat px

    sides, border_colours, warnings = {}, [], quality_warnings(img, quad, flat)
    for s in ("left", "right", "top", "bottom"):
        width, se, valid, ref = measure_side(lab, s, ramp=int(max(4, math.ceil(3 * PPM / src_px_per_mm))))
        if width is None:
            raise ValueError(f"No clear border found on the {s} side. Borderless or "
                             "full-bleed cards need a different centering method.")
        if valid < 0.6:
            warnings.append(f"Border edge was unclear on the {s} side "
                            f"({valid:.0%} of scanlines usable).")
        sides[s] = (width, math.hypot(se, floor))
        border_colours.append(ref)

    # The border is one ink all the way round. If the four sides disagree, we
    # probably measured inside the artwork because the real card edge was missed.
    spread = max(np.linalg.norm(a - b) for a in border_colours for b in border_colours)
    if spread > 30:
        warnings.append("Border colour differs between sides: the card edge was probably "
                        "missed. Retake on a plain background that contrasts with the border.")

    (l, sl), (r, sr) = sides["left"], sides["right"]
    (t, st), (b, sb) = sides["top"], sides["bottom"]
    lr, lr_s = _ratio(l, r, sl, sr)
    tb, tb_s = _ratio(t, b, st, sb)
    worst, sigma, axis = (lr, lr_s, "left/right") if lr >= tb else (tb, tb_s, "top/bottom")

    grade, name = centering_cap(worst, side)
    limit10 = limit_for(10, side)
    p10 = _phi((limit10 - worst) / sigma) if sigma > 0 else float(worst <= limit10)
    # the other axis matters too
    other, other_s = (tb, tb_s) if axis == "left/right" else (lr, lr_s)
    p10 *= _phi((limit10 - other) / other_s) if other_s > 0 else float(other <= limit10)

    # borderline if 2 sigma either way could change the cap
    up, down = centering_cap(max(50.0, worst - 2 * sigma), side), centering_cap(worst + 2 * sigma, side)
    borderline = up[0] != down[0]

    result = SideResult(
        side=side,
        left_mm=round(l / PPM, 2), right_mm=round(r / PPM, 2),
        top_mm=round(t / PPM, 2), bottom_mm=round(b / PPM, 2),
        left_right=_split(l, r), top_bottom=_split(t, b),
        worst_axis=axis, worst_pct=round(worst, 1), uncertainty_pct=round(sigma, 1),
        max_grade=grade, max_grade_name=name,
        chance_centering_ok_for_10=round(p10, 2),
        borderline=borderline, reliable=not warnings, warnings=warnings,
    )
    return result, annotate(flat, sides, result)


def annotate(flat: np.ndarray, sides: dict, r: SideResult) -> np.ndarray:
    out = flat.copy()
    x0, y0, x1, y1 = MARGIN, MARGIN, MARGIN + W, MARGIN + H
    cv2.rectangle(out, (x0, y0), (x1, y1), (255, 200, 0), 3)            # card outline
    il, ir = x0 + int(sides["left"][0]), x1 - int(sides["right"][0])
    it, ib = y0 + int(sides["top"][0]), y1 - int(sides["bottom"][0])
    cv2.rectangle(out, (il, it), (ir, ib), (0, 0, 255), 3)              # inner frame
    font = cv2.FONT_HERSHEY_SIMPLEX
    lines = [f"{r.side.upper()}  L/R {r.left_right}   T/B {r.top_bottom}",
             f"Centering allows up to PSA {r.max_grade} ({r.max_grade_name})"
             + ("  - BORDERLINE" if r.borderline else "")]
    header = np.full((50 * len(lines) + 25, out.shape[1], 3), 25, np.uint8)
    for i, text in enumerate(lines):
        cv2.putText(header, text, (20, 45 + 50 * i), font, 1.1, (255, 255, 255), 2, cv2.LINE_AA)
    out = np.vstack([header, out])
    return out


# ------------------------------------------------------------------- CLI --

def main(argv=None):
    ap = argparse.ArgumentParser(description="GradeWise: PSA centering pre-check")
    ap.add_argument("--front", required=True, help="photo of the card front")
    ap.add_argument("--back", help="photo of the card back (optional)")
    ap.add_argument("--out", default="results", help="folder for annotated images + JSON")
    ap.add_argument("--cropped", action="store_true", help="images are already tightly cropped scans")
    args = ap.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    report = {}
    for side in ("front", "back"):
        path = getattr(args, side)
        if not path:
            continue
        img = cv2.imread(path)
        if img is None:
            sys.exit(f"Cannot read {path}")
        try:
            res, vis = analyse(img, side, args.cropped)
        except ValueError as e:
            sys.exit(f"{side}: {e}")
        cv2.imwrite(os.path.join(args.out, f"{side}_annotated.jpg"), vis)
        report[side] = asdict(res)

    caps = [(report[s]["max_grade"], report[s]["max_grade_name"]) for s in report]
    report["centering_max_grade"] = min(caps)[0]
    report["reliable"] = all(report[s]["reliable"] for s in ("front", "back") if s in report)
    if "back" not in report:
        report["note"] = "Back not checked. PSA 10 also needs 75/25 or better on the back."
    with open(os.path.join(args.out, "centering.json"), "w") as f:
        json.dump(report, f, indent=2)

    for s in ("front", "back"):
        if s in report:
            r = report[s]
            flag = "  (borderline)" if r["borderline"] else ""
            flag += "" if r["reliable"] else "  [UNRELIABLE - retake photo]"
            print(f"{s:>5}: L/R {r['left_right']}  T/B {r['top_bottom']}  "
                  f"worst {r['worst_pct']}% +/- {r['uncertainty_pct']}  "
                  f"-> max PSA {r['max_grade']}{flag}   chance OK for 10: {r['chance_centering_ok_for_10']:.0%}")
            for w in r["warnings"]:
                print(f"       ! {w}")
    print(f"Centering allows at most PSA {report['centering_max_grade']}. "
          f"Saved to {args.out}/")


if __name__ == "__main__":
    main()
