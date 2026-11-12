"""PSA centering limits, per grade.

Source: PSA Grading Standards (psacard.com/gradingstandards). The numbers are
the maximum share of the *wider* border on one axis, e.g. 55 means 55/45.

PSA writes "approximately" for most grades and allows a small variance at the
grader's discretion based on eye appeal, so treat these as hard lines for our
math but soft lines in the real world. Re-check the page before each release:
PSA has changed its 10 standard before (older docs say 60/40 for a 10).

Centering only sets a CEILING. A perfectly centered card can still be a 6 if
the corners are worn. Corners, edges and surface are checked separately.
"""

# (grade, name, front_max_pct, back_max_pct)
PSA_CENTERING = [
    (10, "Gem Mint", 55, 75),
    (9, "Mint", 60, 90),
    (8, "NM-MT", 65, 90),
    (7, "Near Mint", 70, 90),
    (6, "EX-MT", 80, 90),
    (5, "Excellent", 85, 90),
    (4, "VG-EX", 85, 90),
    (3, "Very Good", 90, 90),
    (2, "Good", 90, 90),
]
# Worse than 90/10 on either side: PSA lists no centering requirement for a 1.
FLOOR = (1, "Poor")


def limit_for(grade: int, side: str) -> float:
    for g, _name, front, back in PSA_CENTERING:
        if g == grade:
            return front if side == "front" else back
    raise ValueError(f"no centering limit for grade {grade}")


def centering_cap(worst_pct: float, side: str) -> tuple[int, str]:
    """Highest PSA grade this centering still allows on the given side."""
    for grade, name, front, back in PSA_CENTERING:
        limit = front if side == "front" else back
        if worst_pct <= limit:
            return grade, name
    return FLOOR
