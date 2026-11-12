"""Whitening on corners and edges -> highest PSA grade it allows.

PSA describes corner and edge wear in words, not millimetres
(psacard.com/gradingstandards):

    10  four perfectly sharp corners
     9  sharp corners (one minor flaw elsewhere)
     8  "slightest fraying at one or two corners"
     7  "slight fraying on some corners", minor edge wear
     6  "slight graduated fraying" on corners
     5  "very minor rounding of the corners is becoming evident"
     4  corners slightly rounded

So the millimetre thresholds below are OUR translation of those words and are
PROVISIONAL: they have not been calibrated against graded cards yet. The plan
is to measure 20-30 slabbed cards (Tony's 7 first), see where real 10s, 9s and
8s land, and move the lines. Like centering, the result is a ceiling, not a
grade: surface (scratches, print lines, dents) is not checked yet.
"""

# Corner whitening, by whitened area in mm^2 (white pixels connected to the
# card outline inside the 4 x 4 mm corner zone).
CORNER_LEVELS = [(0.05, "clean"), (0.25, "tiny"), (1.0, "slight"), (3.0, "moderate")]
# Edge whitening, by total length of edge (mm) that shows whitening.
EDGE_LEVELS = [(0.5, "clean"), (3.0, "minor"), (10.0, "slight"), (25.0, "moderate")]
WORST = "heavy"

LEVEL_ORDER = ["clean", "tiny", "minor", "slight", "moderate", "heavy"]


def level(value: float, table) -> str:
    for limit, name in table:
        if value < limit:
            return name
    return WORST


def corners_cap(levels: list[str]) -> int:
    """Highest grade allowed by the corner levels seen on one side of the card."""
    n = {k: levels.count(k) for k in LEVEL_ORDER}
    if n["heavy"]:
        return 4
    if n["moderate"]:
        return 5
    if n["slight"]:
        return 7 if n["slight"] <= 2 else 6
    if n["tiny"]:
        return {1: 9, 2: 8}.get(n["tiny"], 7)
    return 10


def edges_cap(levels: list[str]) -> int:
    """Highest grade allowed by the edge levels seen on one side of the card."""
    n = {k: levels.count(k) for k in LEVEL_ORDER}
    if n["heavy"]:
        return 5
    if n["moderate"]:
        return 6
    if n["slight"]:
        return 8 if n["slight"] == 1 else 7
    if n["minor"]:
        return 9 if n["minor"] <= 2 else 8
    return 10
