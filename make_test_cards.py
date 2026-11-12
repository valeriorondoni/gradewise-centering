"""Generate fake card photos with KNOWN centering, to test centering.py.

Each photo: a yellow-bordered card with random artwork, rounded corners,
placed on a textured "desk" at a random angle and perspective, with blur,
noise, uneven lighting and JPEG compression - roughly what a phone produces.
"""
from __future__ import annotations

import cv2
import numpy as np

PPM = 20
W, H = 63 * PPM, 88 * PPM


def card_face(lr_pct: float, tb_pct: float, rng, total_lr_mm=5.0, total_tb_mm=5.0,
              border_bgr=(40, 200, 240)):
    """lr_pct = left border share in %, tb_pct = top border share in %."""
    left = total_lr_mm * lr_pct / 100 * PPM
    right = total_lr_mm * PPM - left
    top = total_tb_mm * tb_pct / 100 * PPM
    bottom = total_tb_mm * PPM - top
    face = np.empty((H, W, 3), np.uint8)
    face[:] = border_bgr
    x0, x1 = int(round(left)), W - int(round(right))
    y0, y1 = int(round(top)), H - int(round(bottom))
    art = rng.integers(0, 255, (12, 9, 3), dtype=np.uint8)
    art = cv2.resize(art, (x1 - x0, y1 - y0), interpolation=cv2.INTER_CUBIC)
    art = cv2.addWeighted(art, 0.7, np.full_like(art, (120, 60, 160)), 0.3, 0)
    face[y0:y1, x0:x1] = art
    cv2.rectangle(face, (x0 + 2, y0 + 2), (x1 - 3, y1 - 3), (30, 30, 30), 4)  # thin frame line inside the art
    alpha = np.zeros((H, W), np.uint8)
    r = 3 * PPM                                                          # 3 mm corner radius
    cv2.rectangle(alpha, (r, 0), (W - r, H), 255, -1)
    cv2.rectangle(alpha, (0, r), (W, H - r), 255, -1)
    for cx, cy in [(r, r), (W - r, r), (r, H - r), (W - r, H - r)]:
        cv2.circle(alpha, (cx, cy), r, 255, -1)
    true = dict(left=left, right=right, top=top, bottom=bottom)
    return face, alpha, true


def photo(face, alpha, rng, size=(3000, 4000), card_width_px=1500):
    h, w = size[1], size[0]
    desk = rng.integers(60, 120, (h // 40, w // 40, 3), dtype=np.uint8)
    desk = cv2.resize(desk, (w, h), interpolation=cv2.INTER_CUBIC)
    desk = cv2.GaussianBlur(desk, (0, 0), 6)

    s = card_width_px / W
    cw, ch = W * s, H * s
    cx, cy = w / 2 + rng.uniform(-200, 200), h / 2 + rng.uniform(-200, 200)
    ang = np.deg2rad(rng.uniform(-12, 12))
    rot = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
    base = np.array([[-cw / 2, -ch / 2], [cw / 2, -ch / 2], [cw / 2, ch / 2], [-cw / 2, ch / 2]])
    dst = (base @ rot.T) + [cx, cy]
    dst += rng.uniform(-0.04, 0.04, (4, 2)) * [cw, ch]                  # phone not quite flat
    src = np.array([[0, 0], [W, 0], [W, H], [0, H]], dtype=np.float32)
    m = cv2.getPerspectiveTransform(src, dst.astype(np.float32))
    warped = cv2.warpPerspective(face, m, (w, h), flags=cv2.INTER_AREA)
    a = cv2.warpPerspective(alpha, m, (w, h), flags=cv2.INTER_AREA)[..., None] / 255.0
    img = (warped * a + desk * (1 - a)).astype(np.float32)

    yy, xx = np.mgrid[0:h, 0:w]
    light = 0.85 + 0.25 * (xx / w) * (1 - 0.4 * yy / h)                  # uneven lighting
    img = img * light[..., None]
    img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.8, 1.6))
    img += rng.normal(0, 3, img.shape)
    img = np.clip(img, 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)
