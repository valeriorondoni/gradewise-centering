# GradeWise: centering checker (step 1)

Measures a card's centering from a phone photo and tells you the highest PSA
grade that centering allows. It's the first piece of the grade engine:
centering is pure geometry, so we measure it with code instead of guessing
with AI.

## Run it

```bash
pip install -r requirements.txt
python centering.py --front front.jpg --back back.jpg --out results/
```

Output in `results/`:
- `front_annotated.jpg` / `back_annotated.jpg`: the straightened card. Blue box = card edge, red box = where the border ends.
- `centering.json`: the numbers, ready for the backend and database.

Example:
```
front: L/R 57/43  T/B 52/48  worst 57.1% +/- 0.6  -> max PSA 9   chance OK for 10: 0%
 back: L/R 50/50  T/B 70/30  worst 70.0% +/- 0.6  -> max PSA 10  chance OK for 10: 100%
Centering allows at most PSA 9.
```

For flatbed scans that are already cropped to the card, add `--cropped`.

## Test site

```bash
python webapp.py
```

Open http://127.0.0.1:5000, upload the front and back (both required), and
optionally type the centering you measured by hand and the card's real PSA
grade. The page runs centering and whitening on both sides and shows the
ceiling next to your values. Every run is saved in `webtests/` (images,
`run.json`, and a row per side in `log.csv`). The history shows the centering
error across all cards, and how often the ceiling came out *below* a slabbed
card's real grade, which a ceiling should never do.

### Sharing it with the team

1. Once: `winget install --id Cloudflare.cloudflared` (then open a new terminal).
2. Terminal 1: `python webapp.py --share`. It asks for a team password (8+ characters) and starts a multi-user server that still only listens on this PC.
3. Terminal 2: `cloudflared tunnel --protocol http2 --url http://localhost:5000`. It prints a `https://….trycloudflare.com` link. (`--protocol http2` uses plain HTTPS. Without it cloudflared uses QUIC over UDP, which many public and office Wi-Fi networks block: the tunnel then keeps logging "Failed to dial a quic connection".)
4. Send the link and the password (separately). Any username works in the login box.

The link changes every time cloudflared restarts, and it only works while this
PC is on, awake and running both terminals. All results land in this PC's
`webtests/`, so the whole team shares one history. The "Tested by" field
records who uploaded what.

### Hosting (always on, fixed link)

The code lives on GitHub; a hosting service builds the site from the
repository with the `Dockerfile` and redeploys on every push. Any host that
runs Docker works (Render, Railway, Fly.io, Hugging Face Spaces). On the host:

1. Create a web service from the GitHub repository, using the Dockerfile.
2. Set the environment variable `GRADEWISE_PASSWORD` (8+ plain characters). Without it the site refuses to start, so it is never online without a password.
3. Attach a **persistent disk**, mount it at `/data` and set `DATA_DIR=/data`. Without it the test history and uploaded photos are wiped on every restart or redeploy (free plans usually have no persistent disk).

`python webapp.py --deploy` is what the container runs: it listens on `$PORT`
on all interfaces and stores tests in `$DATA_DIR`.

What goes into the repository is set by `.gitignore`: the team's uploads
(`webtests/`), the local `.venv/` and personal runs stay out.

## Whitening on corners and edges (step 2)

```bash
python wear.py --front front.jpg --back back.jpg --out results/
```

Measures where the ink has worn off the edge and the white paper shows.
Output: `front_wear.jpg` / `back_wear.jpg` (magenta = whitened pixels, corner
boxes and edge bars coloured by level), `front_corners.jpg` /
`back_corners.jpg` (the four corners enlarged 3x with whitening outlined) and
`wear.json`.

- **Corners** (4 × 4 mm zones): whitened area in mm². Levels: clean < 0.05, tiny < 0.25, slight < 1, moderate < 3, heavy.
- **Edges** (between the corners): length of edge showing whitening, in mm. Levels: clean < 0.5, minor < 3, slight < 10, moderate < 25, heavy.
- `wear_standards.py` turns the levels into a PSA ceiling. PSA describes wear only in words ("slightest fraying at one or two corners" for an 8), so **these thresholds are ours and provisional** until they're calibrated on real slabbed cards. Use the test site's "real PSA grade" field for this.

`python test_wear.py` paints whitening of known size (ragged, like real
fraying) on synthetic yellow and blue cards and photographs them the same way
as the centering test. Current result: no false whitening on clean cards,
edge length median error 1%, corner area median error 18% (it reads slightly
low, because the blur at the very edge mixes with the background). No zone is
more than one level off. Whitening thinner than about 0.15 mm is mostly
missed at phone resolution.

## PSA rules used (`psa_standards.py`)

The worse border can be at most this share of the total, per axis:

| PSA grade | Front | Back |
|---|---|---|
| 10 Gem Mint | 55/45 | 75/25 |
| 9 Mint | 60/40 | 90/10 |
| 8 NM-MT | 65/35 | 90/10 |
| 7 NM | 70/30 | 90/10 |
| 6 EX-MT | 80/20 | 90/10 |
| 5 EX / 4 VG-EX | 85/15 | 90/10 |
| 3 VG / 2 Good | 90/10 | 90/10 |

Both axes count (left/right and top/bottom), and front and back are checked
separately; the lower cap wins. PSA says "approximately" and allows a little
grader discretion, so results near a limit are marked **borderline**.

**Centering is a ceiling, not a grade.** A perfectly centered card with a
whitened corner is not a 10. Corners, edges and surface come next.

## What the JSON fields mean

- `worst_pct`, `uncertainty_pct`: e.g. 57.1 ± 0.6 means the wider border is 57.1% of the total, give or take 0.6.
- `max_grade`: highest PSA grade the centering allows on that side.
- `chance_centering_ok_for_10`: probability that the true centering is within the PSA 10 limit, given the measurement uncertainty. This feeds the "is it worth grading?" calculation later. It covers measurement error only, not grader discretion.
- `borderline`: the measurement is close enough to a limit that the cap could go either way.
- `reliable`: `false` if the photo has problems (low resolution, blur, glare, missed edge). The app should ask for a retake rather than show a verdict.

## Tested

`python test_centering.py` builds fake phone photos with *known* centering
(random tilt and perspective, rounded corners, blur, noise, uneven lighting,
JPEG compression; yellow, blue and silver borders) and checks the results.
Current result: mean error 0.1 percentage points, max 0.5. No confident wrong
caps; the only cap mismatches are cards sitting exactly on a limit, and those
are flagged borderline.

### First real card: 1996 Japanese Charizard (base set), scanned in a PSA slab

| Side | Left/Right | Top/Bottom | Centering allows |
|---|---|---|---|
| Front | 51/49 | 55/45 (eye check: ~53/47) | PSA 9, borderline with 10 |
| Back | 49/51 | 52/48 | PSA 10 (needs 75/25) |

Checked by eye on zoomed crops. Left, right and bottom borders line up with
the gold edge; the top gold fades softly into the pink and the tool puts that
edge about 0.25 mm too low, which is why it says 55/45 where the eye says
~53/47. The scan is only ~560 px wide, so the result is flagged unreliable.

Making this card work required three changes, all now in the code:
- **Slab scans:** a dark gap and the bright plastic rim sit just outside the card, sometimes with a stronger edge than the card itself. The tool now takes the innermost edge.
- **Shaded vintage gold borders:** the border isn't one flat colour, so "where the colour changes" fails. The inner edge is now the straight line that's consistent along the whole side.
- **Old Japanese backs:** the swirl runs right to the edge and the reference is a thin red frame line. Using the median across scanlines removes the swirl and the light rays and keeps the line.

## Known limits (be honest about these in the pitch)

1. **One real card so far.** Next step: 20–30 real cards with borders measured by hand or with a centering tool. Tony's 7 cards at PSA are the first real benchmark.
2. **Soft border transitions** (shaded gold fading into the card colour) can shift the measured edge by ~0.25 mm at low resolution. Higher-resolution photos shrink this.
3. **Full-art and silver-border cards.** When the artwork runs into a patterned silver border (like the Mega Charizard X SAR), there's no clean straight line where the border ends. The tool now refuses `samples/charizard_raw_from_slide.png` ("no clear border found") rather than guessing. These cards need their own method, e.g. measuring to the printed text box or artwork edge.
4. **Borderless cards** (some sports and modern cards) have no border to measure; the checker refuses them.
5. **Photo rules:** card out of its sleeve, flat, on a plain background that contrasts with the border, card at least ~1000 px wide in the photo, no direct glare. The blur threshold still needs tuning on real phone photos.
6. Assumes standard 63 × 88 mm cards (Pokémon, Magic, One Piece, standard sports). Mini or oversized cards need different dimensions.
7. **Whitening needs a dark background.** On a light background the blended edge pixels look like whitening; the tool skips them and marks the result unreliable. Glare on the border also reads as whitening (the glare warning catches large patches).
8. **Whitening can't be measured where the border isn't a flat colour** (old Japanese swirl backs, full-art and silver borders) or is already near white (white-border cards). Those zones are reported as "unknown", not guessed.
9. **Slab photos are a poor input for whitening:** the slab's bright plastic rim can touch the card edge and read as whitening (seen on a Donphan slab scan). Photograph the bare card.
10. Corner radius is assumed to be 3 mm. Surface (scratches, print lines, dents) is not checked yet.

## Files

- `centering.py`: detection, measurement, PSA mapping, CLI
- `psa_standards.py`: PSA centering limits per grade
- `make_test_cards.py`: synthetic test photo generator
- `test_centering.py`: accuracy test
- `wear.py`: whitening on corners and edges, CLI
- `wear_standards.py`: whitening levels and the (provisional) PSA ceilings
- `test_wear.py`: whitening accuracy test
- `webapp.py`: test site (Flask): local, shared through a tunnel, or hosted
- `Dockerfile`, `.dockerignore`: container for hosting the site
- `.gitignore`: keeps uploads, the local environment and personal runs out of git
- `samples/`: two synthetic photos, the raw card cropped from the pitch slide, and `real/` with the Japanese Charizard front and back
