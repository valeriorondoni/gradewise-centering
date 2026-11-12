"""Accuracy test: python test_centering.py

Builds fake photos with known centering and checks that centering.py
(a) measures the ratio within 1 percentage point and
(b) gives the right PSA cap whenever the truth isn't right on a limit.
"""
import numpy as np

from centering import analyse
from make_test_cards import card_face, photo
from psa_standards import centering_cap

CASES = [  # (left share %, top share %, card width in photo px[, border colour BGR])
    (50, 50, 1500), (52, 49, 1500), (53.5, 51, 1200), (57, 50, 1500),
    (50, 58, 1500), (62, 52, 1500), (67, 55, 1000), (72, 50, 1500),
    (45, 60, 1800), (78, 50, 1500), (56.5, 50, 900), (51, 63, 1500),
    # blue, Pokemon-back-like border: about as bright as the desk, colour differs
    (50, 70, 1500, (160, 90, 30)), (60, 50, 1200, (160, 90, 30)),
    # silver-ish border
    (52, 55, 1500, (190, 190, 185)),
]


def main():
    rng = np.random.default_rng(7)
    errors, wrong_caps, rows = [], 0, []
    for lr, tb, px, *colour in CASES:
        face, alpha, true = card_face(lr, tb, rng, **({"border_bgr": colour[0]} if colour else {}))
        img = photo(face, alpha, rng, card_width_px=px)
        res, _ = analyse(img, "front")

        t_lr = 100 * max(true["left"], true["right"]) / (true["left"] + true["right"])
        t_tb = 100 * max(true["top"], true["bottom"]) / (true["top"] + true["bottom"])
        t_worst = max(t_lr, t_tb)
        t_cap = centering_cap(t_worst, "front")[0]
        err = res.worst_pct - t_worst
        errors.append(abs(err))
        cap_ok = res.max_grade == t_cap
        if not cap_ok and not res.borderline and res.reliable:
            wrong_caps += 1
        rows.append(f"true {t_worst:5.1f}%  measured {res.worst_pct:5.1f}% ± {res.uncertainty_pct:.1f}"
                    f"  err {err:+.2f}  cap true {t_cap} / got {res.max_grade}"
                    f"{' (borderline)' if res.borderline else ''}  px={px}"
                    f"{'' if cap_ok else '  <-- cap differs'}")

    print("\n".join(rows))
    print(f"\nmean abs error {np.mean(errors):.2f} pts, max {np.max(errors):.2f} pts, "
          f"confident-but-wrong caps: {wrong_caps}")
    assert np.max(errors) < 1.0, "ratio error above 1 point"
    assert wrong_caps == 0, "a cap was wrong without being flagged borderline"
    print("PASS")


if __name__ == "__main__":
    main()
