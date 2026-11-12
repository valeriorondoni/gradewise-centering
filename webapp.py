"""Local test site for the grade engine (centering + whitening).

    pip install -r requirements.txt
    python webapp.py          then open http://127.0.0.1:5000
    python webapp.py --share  same, but asks for a team password first and runs
                              on a multi-user server, ready to put behind a tunnel
                              (cloudflared tunnel --protocol http2 --url http://localhost:5000)
    python webapp.py --deploy on a hosting service: listens on $PORT, takes the
                              password from $GRADEWISE_PASSWORD and stores tests
                              in $DATA_DIR (see README, "Hosting")

Upload the front and back of a card. Optionally type the centering you
measured by hand (e.g. 52/48) and, for a slabbed card, its real PSA grade.
The page shows the tool's results next to yours. Every run is saved in
webtests/ (annotated images, run.json, one row per side in log.csv), and the
history at the bottom shows the centering error across all tested cards and
how often the tool's ceiling came out below a card's real grade (which a
ceiling should never do).
"""
from __future__ import annotations

import argparse
import csv
import getpass
import hmac
import json
import os
import secrets
import threading
from dataclasses import asdict
from datetime import datetime

import cv2
import numpy as np
from flask import (Flask, Response, abort, redirect, render_template_string, request,
                   send_from_directory, url_for)

from centering import analyse
from wear import analyse_wear

HERE = os.path.dirname(os.path.abspath(__file__))
# On a host, point DATA_DIR at a persistent disk, or the history is lost on every restart
TESTS = os.environ.get("DATA_DIR") or os.path.join(HERE, "webtests")
LOG = os.path.join(TESTS, "log.csv")
LOG_FIELDS = ["time", "run", "tester", "name", "side", "cropped", "actual_grade", "ceiling",
              "measured_lr", "measured_tb", "ref_lr", "ref_tb", "err_lr", "err_tb",
              "worst_pct", "uncertainty_pct", "centering_max_grade", "borderline", "centering_reliable",
              "corners_max_grade", "edges_max_grade", "wear_levels", "wear_reliable",
              "warnings", "error"]
SHORT = {"top-left": "TL", "top-right": "TR", "bottom-right": "BR", "bottom-left": "BL",
         "top": "T", "right": "R", "bottom": "B", "left": "L"}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
PASSWORD = None                  # set by --share; None = no login (local use only)
LOG_LOCK = threading.Lock()      # several teammates can upload at once


@app.before_request
def require_password():
    """Browser login box; any username, the team password."""
    if PASSWORD is None:
        return None
    auth = request.authorization
    if auth and auth.password and hmac.compare_digest(auth.password.encode(), PASSWORD.encode()):
        return None
    return Response("Password required.", 401, {"WWW-Authenticate": 'Basic realm="GradeWise test"'})


# --------------------------------------------------------------- helpers --

def _parse_ref(text: str) -> float | None:
    """'52/48', '52', '52.5/47.5' -> share of the first side (left or top) in %."""
    text = (text or "").strip().replace(",", ".")
    if not text:
        return None
    a, _, b = text.partition("/")
    try:
        a = float(a)
        if b.strip():
            a = 100 * a / (a + float(b))
    except (ValueError, ZeroDivisionError):
        return None
    return a if 0 < a < 100 else None


def _parse_grade(text: str) -> float | None:
    try:
        g = float((text or "").strip().replace(",", "."))
    except ValueError:
        return None
    return g if 1 <= g <= 10 else None


MIN_PHOTO_PX = 500    # shorter side; below this nothing useful can be measured


def _explain(msg: str) -> str:
    """Turn the engine's error into what the tester should do differently."""
    if msg.startswith("Could not find the card"):
        return ("Couldn't find the card's outline. Photograph the bare card (out of its sleeve, "
                "top loader or slab: the plastic edges confuse the detection) on a plain dark surface, "
                "with some background visible on all four sides. If the image is a scan cropped exactly "
                "to the card, tick \"already cropped\".")
    if msg.startswith("No clear border found"):
        return ("This card has no plain border to measure: full-art, illustration rare, special art "
                "or textured silver borders aren't supported yet. Test with a card that has a normal "
                "coloured border.")
    return msg


def _share(a: float, b: float) -> float:
    return round(100 * a / (a + b), 1)


def _run_side(file, side: str, cropped: bool, run_dir: str, ref_lr: str, ref_tb: str) -> dict:
    out = {"side": side, "error": None, "centering": None, "centering_error": None,
           "wear": None, "wear_error": None, "images": {},
           "ref_lr": _parse_ref(ref_lr), "ref_tb": _parse_ref(ref_tb),
           "measured_lr": None, "measured_tb": None, "err_lr": None, "err_tb": None}
    data = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR) if data.size else None
    if img is None:
        out["error"] = "Could not read this image."
        return out
    cv2.imwrite(os.path.join(run_dir, f"{side}_input.jpg"), img)
    h, w = img.shape[:2]
    if min(h, w) < MIN_PHOTO_PX:
        out["error"] = (f"The image is only {w} × {h} px, far too small to measure (the card should be "
                        "1000+ px wide). Upload the original photo, not a thumbnail, screenshot or "
                        "image saved from a chat app.")
        return out

    try:
        res, vis = analyse(img, side, cropped)
        cv2.imwrite(os.path.join(run_dir, f"{side}_centering.jpg"), vis)
        r = asdict(res)
        out["centering"], out["images"]["centering"] = r, f"{side}_centering.jpg"
        # left share and top share in %, compared with the hand measurement
        out["measured_lr"] = _share(r["left_mm"], r["right_mm"])
        out["measured_tb"] = _share(r["top_mm"], r["bottom_mm"])
        if out["ref_lr"] is not None:
            out["err_lr"] = round(out["measured_lr"] - out["ref_lr"], 1)
        if out["ref_tb"] is not None:
            out["err_tb"] = round(out["measured_tb"] - out["ref_tb"], 1)
    except ValueError as e:
        out["centering_error"] = _explain(str(e))

    try:
        res, vis, zoom = analyse_wear(img, side, cropped)
        cv2.imwrite(os.path.join(run_dir, f"{side}_wear.jpg"), vis)
        cv2.imwrite(os.path.join(run_dir, f"{side}_corners.jpg"), zoom)
        out["wear"] = asdict(res)
        out["images"]["wear"], out["images"]["corners"] = f"{side}_wear.jpg", f"{side}_corners.jpg"
    except ValueError as e:
        out["wear_error"] = _explain(str(e))
    return out


def _summarise(run: dict):
    """Overall ceiling = lowest of every cap that could be measured."""
    c = [s["centering"]["max_grade"] for s in run["sides"] if s["centering"]]
    w = [s["wear"]["max_grade"] for s in run["sides"] if s["wear"]]
    run["centering_cap"] = min(c) if len(c) == 2 else None
    run["wear_cap"] = min(w) if len(w) == 2 else None
    caps = [x for x in (run["centering_cap"], run["wear_cap"]) if x is not None]
    run["ceiling"] = min(caps) if len(caps) == 2 else None
    run["reliable"] = all(s["centering"] and s["centering"]["reliable"] and s["wear"] and s["wear"]["reliable"]
                          for s in run["sides"])


def _log(run: dict):
    with LOG_LOCK:
        _write_log(run)


def _write_log(run: dict):
    if os.path.exists(LOG):                     # log written by an older version of this page
        with open(LOG, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            header, old_rows = reader.fieldnames or [], list(reader)
        if header != LOG_FIELDS:
            if set(header) <= set(LOG_FIELDS):  # only columns were added: rewrite with the new ones
                with open(LOG, "w", newline="", encoding="utf-8") as f:
                    w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
                    w.writeheader()
                    w.writerows(old_rows)
            else:                               # incompatible: keep it aside
                os.replace(LOG, os.path.join(TESTS, f"log_old_{run['id']}.csv"))
    new = not os.path.exists(LOG)
    with open(LOG, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        if new:
            w.writeheader()
        for s in run["sides"]:
            c, wr = s["centering"] or {}, s["wear"] or {}
            zones = wr.get("corners", []) + wr.get("edges", [])
            warnings = c.get("warnings", []) + [x for x in wr.get("warnings", []) if x not in c.get("warnings", [])]
            errors = [e for e in (s["error"], s["centering_error"], s["wear_error"]) if e]
            w.writerow({
                "time": run["time"], "run": run["id"], "tester": run.get("tester", ""),
                "name": run["name"], "side": s["side"],
                "cropped": run["cropped"], "actual_grade": run["actual_grade"], "ceiling": run["ceiling"],
                "measured_lr": s["measured_lr"], "measured_tb": s["measured_tb"],
                "ref_lr": s["ref_lr"], "ref_tb": s["ref_tb"], "err_lr": s["err_lr"], "err_tb": s["err_tb"],
                "worst_pct": c.get("worst_pct"), "uncertainty_pct": c.get("uncertainty_pct"),
                "centering_max_grade": c.get("max_grade"), "borderline": c.get("borderline"),
                "centering_reliable": c.get("reliable"),
                "corners_max_grade": wr.get("corners_max_grade"), "edges_max_grade": wr.get("edges_max_grade"),
                "wear_levels": " ".join(f"{SHORT[z['name']]}:{z['level']}" for z in zones),
                "wear_reliable": wr.get("reliable"),
                "warnings": " | ".join(warnings), "error": " | ".join(errors),
            })


def _history():
    if not os.path.exists(LOG):
        return [], {}
    with open(LOG, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if rows and "ceiling" not in rows[0]:
        return [], {}
    rows.reverse()

    def centering_stats(only_reliable: bool):
        errs = [abs(float(r[k])) for r in rows for k in ("err_lr", "err_tb")
                if r[k] and (r["centering_reliable"] == "True" or not only_reliable)]
        if not errs:
            return None
        return {"n": len(errs), "mean": sum(errs) / len(errs), "max": max(errs),
                "within1": sum(e <= 1 for e in errs) / len(errs)}

    # one entry per run that has both a real grade and a ceiling
    graded = {r["run"]: (float(r["actual_grade"]), int(r["ceiling"]))
              for r in rows if r["actual_grade"] and r["ceiling"]}
    grade_stats = None
    if graded:
        below = sum(ceiling < actual for actual, ceiling in graded.values())
        exact = sum(ceiling == actual for actual, ceiling in graded.values())
        grade_stats = {"n": len(graded), "below": below, "exact": exact}
    return rows, {"all": centering_stats(False), "reliable": centering_stats(True), "grades": grade_stats}


# ---------------------------------------------------------------- routes --

@app.post("/")
def upload():
    front, back = request.files.get("front"), request.files.get("back")
    if not (front and front.filename and back and back.filename):
        return redirect(url_for("index", missing=1))
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(3)
    run_dir = os.path.join(TESTS, run_id)
    os.makedirs(run_dir, exist_ok=True)
    cropped = bool(request.form.get("cropped"))
    run = {"id": run_id, "time": datetime.now().strftime("%Y-%m-%d %H:%M"),
           "tester": request.form.get("tester", "").strip()[:40],
           "name": request.form.get("name", "").strip(), "cropped": cropped,
           "actual_grade": _parse_grade(request.form.get("actual_grade", "")), "sides": []}
    for side, f in (("front", front), ("back", back)):
        run["sides"].append(_run_side(f, side, cropped, run_dir,
                                      request.form.get(f"{side}_ref_lr", ""),
                                      request.form.get(f"{side}_ref_tb", "")))
    _summarise(run)
    with open(os.path.join(run_dir, "run.json"), "w", encoding="utf-8") as f:
        json.dump(run, f, indent=2)
    _log(run)
    return redirect(url_for("index", run=run_id))


@app.get("/")
def index():
    run = None
    run_id = request.args.get("run", "")
    path = os.path.join(TESTS, os.path.basename(run_id), "run.json")
    if run_id and os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            run = json.load(f)
        if "ceiling" not in run:          # run saved by the first version of this page
            run = None
    rows, stats = _history()
    return render_template_string(PAGE, run=run, rows=rows, stats=stats,
                                  missing=bool(request.args.get("missing")))


@app.get("/tests/<run_id>/<name>")
def test_file(run_id, name):
    folder = os.path.join(TESTS, os.path.basename(run_id))
    if not os.path.isdir(folder):
        abort(404)
    return send_from_directory(folder, os.path.basename(name))


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GradeWise test</title>
<style>
  :root { --bg:#f6f6f4; --card:#fff; --ink:#1d1d1b; --muted:#6b6b66; --line:#e2e2dc;
          --accent:#2457d6; --ok:#1d7a3a; --warn:#b35c00; --bad:#b3261e; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font:15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:22px; margin:0 0 4px; } h2 { font-size:18px; margin:32px 0 12px; }
  h3 { font-size:15px; margin:16px 0 6px; }
  .sub { color:var(--muted); margin:0 0 20px; }
  .box { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }
  fieldset { border:1px solid var(--line); border-radius:8px; margin:0; padding:12px; }
  legend { font-weight:600; padding:0 4px; }
  label { display:block; margin:8px 0 4px; font-size:13px; color:var(--muted); }
  input[type=text] { width:100%; padding:7px 9px; border:1px solid var(--line); border-radius:6px; font:inherit; }
  .refs { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .row { display:flex; flex-wrap:wrap; gap:16px; align-items:center; margin-top:14px; }
  .row label { margin:0; color:var(--ink); font-size:14px; }
  button { background:var(--accent); color:#fff; border:0; border-radius:6px; padding:9px 18px;
           font:inherit; font-weight:600; cursor:pointer; }
  .results { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }
  .results img { width:100%; border-radius:6px; display:block; margin-top:10px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  td, th { text-align:left; padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:500; }
  .num { font-variant-numeric:tabular-nums; }
  .tag { display:inline-block; padding:1px 7px; border-radius:99px; font-size:12px; font-weight:600; }
  .ok { background:#e3f3e7; color:var(--ok); } .warn { background:#fdf0e1; color:var(--warn); }
  .bad { background:#fbe7e5; color:var(--bad); } .muted { background:#ececea; color:var(--muted); }
  .msgs { margin:8px 0 0; padding-left:18px; color:var(--warn); font-size:13px; }
  .err { color:var(--bad); }
  .note { color:var(--muted); font-size:13px; }
  .stats { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:12px; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:10px 14px; }
  .stat b { font-size:20px; display:block; }
  .summary { display:flex; flex-wrap:wrap; gap:24px; align-items:baseline; }
  .summary b { font-size:22px; }
  .scroll { overflow-x:auto; }
  a { color:var(--accent); }
</style>
</head>
<body><main>
<h1>GradeWise · grade engine test</h1>
<p class="sub">Upload the front and back of a card. Optionally add the centering you measured by hand and the card's real PSA grade, then compare with the tool.</p>

<details class="box" style="margin-bottom:16px" open>
  <summary><strong>How to take the photos</strong> (most failed tests come from the photo, not the tool)</summary>
  <ul style="margin:10px 0 0; padding-left:20px">
    <li><b>Bare card</b>: out of its sleeve, top loader or slab.</li>
    <li><b>Plain dark surface</b> (black cloth, dark desk), with background visible on all four sides of the card.</li>
    <li><b>From straight above</b>, card filling most of the photo, sharp, no reflections or direct light on it.</li>
    <li><b>Original photo file</b>: not a thumbnail, screenshot, or image sent through WhatsApp/Telegram (they shrink it). The card should be at least 1000 px wide.</li>
    <li><b>Cards with a normal coloured border</b> (e.g. yellow Pokémon fronts, blue backs). Full-art, illustration rare and silver-border cards aren't supported yet.</li>
  </ul>
</details>

{% if missing %}<p class="err">Please upload both the front and the back: both are needed for a grade.</p>{% endif %}
<form class="box" method="post" enctype="multipart/form-data">
  <div class="refs">
    <div><label for="tester">Tested by</label>
      <input type="text" id="tester" name="tester" placeholder="your name" maxlength="40"></div>
    <div></div>
    <div><label for="name">Card name (optional)</label>
      <input type="text" id="name" name="name" placeholder="e.g. Donphan SWSH067"></div>
    <div><label for="actual_grade">Real PSA grade, if slabbed (optional)</label>
      <input type="text" id="actual_grade" name="actual_grade" placeholder="e.g. 9"></div>
  </div>
  <div class="grid" style="margin-top:12px">
    {% for side, title in [("front", "Front"), ("back", "Back")] %}
    <fieldset>
      <legend>{{ title }}</legend>
      <input type="file" name="{{ side }}" accept="image/*" required>
      <div class="refs">
        <div><label>True left/right</label><input type="text" name="{{ side }}_ref_lr" placeholder="e.g. 52/48"></div>
        <div><label>True top/bottom</label><input type="text" name="{{ side }}_ref_tb" placeholder="e.g. 50/50"></div>
      </div>
    </fieldset>
    {% endfor %}
  </div>
  <div class="row">
    <label><input type="checkbox" name="cropped"> Images are already cropped to the card (scans)</label>
    <button type="submit">Analyse</button>
  </div>
</form>
<script>
  // remember the tester's name on this browser
  (function () {
    var f = document.getElementById("tester");
    try { f.value = localStorage.getItem("gw-tester") || ""; } catch (e) {}
    f.form.addEventListener("submit", function () {
      try { localStorage.setItem("gw-tester", f.value); } catch (e) {}
    });
  })();
</script>

{% macro level_tag(lvl) -%}
  <span class="tag {{ {'clean':'ok','tiny':'warn','minor':'warn','slight':'warn','moderate':'bad','heavy':'bad'}.get(lvl, 'muted') }}">{{ lvl }}</span>
{%- endmacro %}

{% if run %}
<h2>Result{% if run.name %}: {{ run.name }}{% endif %}{% if run.tester %} <span class="note">· tested by {{ run.tester }}</span>{% endif %}</h2>
<div class="box summary">
  <div>Centering allows<br><b>{{ "PSA %d"|format(run.centering_cap) if run.centering_cap else "–" }}</b></div>
  <div>Whitening allows<br><b>{{ "PSA %d"|format(run.wear_cap) if run.wear_cap else "–" }}</b></div>
  <div>Ceiling so far<br><b>{{ "PSA %d"|format(run.ceiling) if run.ceiling else "–" }}</b></div>
  {% if run.actual_grade %}<div>Real grade<br><b>PSA {{ "%g"|format(run.actual_grade) }}</b>
    {% if run.ceiling and run.ceiling < run.actual_grade %}<span class="tag bad">ceiling below real grade</span>{% endif %}</div>{% endif %}
  <div>{% if run.reliable %}<span class="tag ok">reliable</span>{% else %}<span class="tag bad">unreliable: see warnings</span>{% endif %}</div>
</div>
<p class="note">The ceiling is the highest grade centering and whitening allow. Surface is not checked yet, so it is not a grade. Whitening thresholds are provisional.</p>

<div class="results">
  {% for s in run.sides %}
  <div class="box">
    <strong>{{ s.side|capitalize }}</strong>
    {% if s.error %}<p class="err">{{ s.error }}</p>{% else %}

    <h3>Centering</h3>
    {% if s.centering_error %}
      <p class="err">{{ s.centering_error }}</p>
    {% elif s.centering %}{% set r = s.centering %}
      <span class="tag {{ 'ok' if r.reliable else 'bad' }}">{{ "reliable" if r.reliable else "unreliable" }}</span>
      {% if r.borderline %}<span class="tag warn">borderline</span>{% endif %}
      <table style="margin-top:10px">
        <tr><th></th><th>Tool</th><th>True</th><th>Error</th></tr>
        <tr><td>Left/right</td><td class="num">{{ r.left_right }} <small>({{ s.measured_lr }})</small></td>
            <td class="num">{{ "%.1f"|format(s.ref_lr) if s.ref_lr is not none else "–" }}</td>
            <td class="num">{{ "%+.1f"|format(s.err_lr) if s.err_lr is not none else "–" }}</td></tr>
        <tr><td>Top/bottom</td><td class="num">{{ r.top_bottom }} <small>({{ s.measured_tb }})</small></td>
            <td class="num">{{ "%.1f"|format(s.ref_tb) if s.ref_tb is not none else "–" }}</td>
            <td class="num">{{ "%+.1f"|format(s.err_tb) if s.err_tb is not none else "–" }}</td></tr>
      </table>
      <p class="num" style="margin:10px 0 0">Worst {{ r.worst_pct }}% ± {{ r.uncertainty_pct }} ({{ r.worst_axis }})
        → max <b>PSA {{ r.max_grade }}</b> · chance OK for a 10: {{ "%.0f"|format(100 * r.chance_centering_ok_for_10) }}%</p>
      <p class="num note" style="margin:4px 0 0">Borders in mm: L {{ r.left_mm }} · R {{ r.right_mm }} · T {{ r.top_mm }} · B {{ r.bottom_mm }}</p>
      {% if r.warnings %}<ul class="msgs">{% for w in r.warnings %}<li>{{ w }}</li>{% endfor %}</ul>{% endif %}
      <img src="{{ url_for('test_file', run_id=run.id, name=s.images.centering) }}" alt="centering, annotated">
    {% endif %}

    <h3>Whitening (corners and edges)</h3>
    {% if s.wear_error %}
      <p class="err">{{ s.wear_error }}</p>
    {% elif s.wear %}{% set w = s.wear %}
      <span class="tag {{ 'ok' if w.reliable else 'bad' }}">{{ "reliable" if w.reliable else "unreliable" }}</span>
      <p style="margin:8px 0">Corners allow <b>PSA {{ w.corners_max_grade }}</b> · edges allow <b>PSA {{ w.edges_max_grade }}</b></p>
      <table>
        <tr><th>Corner</th><th>Whitened</th><th>Level</th></tr>
        {% for z in w.corners %}
        <tr><td>{{ z.name }}</td><td class="num">{{ "%.2f"|format(z.area_mm2) }} mm²</td><td>{{ level_tag(z.level) }}</td></tr>
        {% endfor %}
        <tr><th>Edge</th><th>Whitened length</th><th>Level</th></tr>
        {% for z in w.edges %}
        <tr><td>{{ z.name }}</td><td class="num">{{ "%.1f"|format(z.length_mm) }} mm</td><td>{{ level_tag(z.level) }}</td></tr>
        {% endfor %}
      </table>
      {% set extra = w.warnings|reject("in", s.centering.warnings if s.centering else [])|list %}
      {% if extra %}<ul class="msgs">{% for x in extra %}<li>{{ x }}</li>{% endfor %}</ul>{% endif %}
      <img src="{{ url_for('test_file', run_id=run.id, name=s.images.corners) }}" alt="corners, enlarged">
      <img src="{{ url_for('test_file', run_id=run.id, name=s.images.wear) }}" alt="whitening, annotated">
    {% endif %}
    {% endif %}
  </div>
  {% endfor %}
</div>
<p class="note">Centering error = tool − true, in percentage points of the left (or top) border's share. Blue box = card edge, red box = end of the printed border.
Whitening: magenta = whitened pixels; corner boxes and edge bars are coloured by level (green clean, orange tiny/minor/slight, red moderate/heavy, grey not measurable).</p>
{% endif %}

<h2>History</h2>
{% if stats.all or stats.grades %}
<div class="stats">
  {% if stats.all %}
  <div class="stat">Centering checks with a true value<b class="num">{{ stats.all.n }}</b></div>
  <div class="stat">Mean error<b class="num">{{ "%.2f"|format(stats.all.mean) }} pts</b></div>
  <div class="stat">Max error<b class="num">{{ "%.1f"|format(stats.all.max) }} pts</b></div>
  <div class="stat">Within 1 pt<b class="num">{{ "%.0f"|format(100 * stats.all.within1) }}%</b></div>
  {% if stats.reliable %}
  <div class="stat">Reliable only: mean / max<b class="num">{{ "%.2f"|format(stats.reliable.mean) }} / {{ "%.1f"|format(stats.reliable.max) }} pts</b></div>
  {% endif %}{% endif %}
  {% if stats.grades %}
  <div class="stat">Graded cards tested<b class="num">{{ stats.grades.n }}</b></div>
  <div class="stat">Ceiling below real grade<b class="num">{{ stats.grades.below }}</b></div>
  <div class="stat">Ceiling = real grade<b class="num">{{ stats.grades.exact }}</b></div>
  {% endif %}
</div>
{% endif %}
{% if rows %}
<div class="box scroll"><table>
  <tr><th>Date</th><th>By</th><th>Card</th><th>Side</th><th>L/R tool</th><th>L/R true</th><th>Err</th>
      <th>T/B tool</th><th>T/B true</th><th>Err</th><th>Centering</th><th>Corners</th><th>Edges</th>
      <th>Ceiling</th><th>Real</th><th>Status</th></tr>
  {% for r in rows %}
  <tr>
    <td><a href="{{ url_for('index', run=r.run) }}">{{ r.time }}</a></td>
    <td>{{ r.tester or "–" }}</td>
    <td>{{ r.name or "–" }}</td>
    <td>{{ r.side|capitalize }}</td>
    <td class="num">{{ r.measured_lr or "–" }}</td><td class="num">{{ r.ref_lr or "–" }}</td><td class="num">{{ r.err_lr or "–" }}</td>
    <td class="num">{{ r.measured_tb or "–" }}</td><td class="num">{{ r.ref_tb or "–" }}</td><td class="num">{{ r.err_tb or "–" }}</td>
    <td class="num">{{ r.centering_max_grade or "–" }}</td>
    <td class="num">{{ r.corners_max_grade or "–" }}</td><td class="num">{{ r.edges_max_grade or "–" }}</td>
    <td class="num">{{ r.ceiling or "–" }}</td><td class="num">{{ r.actual_grade or "–" }}</td>
    <td>{% if r.error %}<span class="tag bad" title="{{ r.error }}">error</span>
        {% elif r.centering_reliable == "True" and r.wear_reliable == "True" %}<span class="tag ok">ok</span>
        {% else %}<span class="tag bad" title="{{ r.warnings }}">unreliable</span>{% endif %}
        {% if r.borderline == "True" %}<span class="tag warn">borderline</span>{% endif %}</td>
  </tr>
  {% endfor %}
</table></div>
<p class="note">Everything is saved in <code>webtests/</code>; <code>log.csv</code> opens in Excel. Ceiling and real grade are per card, shown on both rows.</p>
{% else %}
<p class="note">No tests yet.</p>
{% endif %}
</main></body></html>
"""

def main(argv=None):
    global PASSWORD
    ap = argparse.ArgumentParser(description="GradeWise test site")
    ap.add_argument("--share", action="store_true",
                    help="ask for a team password and use a multi-user server (for a tunnel)")
    ap.add_argument("--deploy", action="store_true",
                    help="run on a hosting service: $PORT, $GRADEWISE_PASSWORD, $DATA_DIR")
    ap.add_argument("--port", type=int, default=5000)
    args = ap.parse_args(argv)
    os.makedirs(TESTS, exist_ok=True)

    if not (args.share or args.deploy):
        print(f"GradeWise test site (only this PC): http://127.0.0.1:{args.port}")
        app.run(host="127.0.0.1", port=args.port)
        return

    PASSWORD = os.environ.get("GRADEWISE_PASSWORD")
    if args.deploy and not PASSWORD:
        # never serve the site on the internet without a password
        raise SystemExit("Set the GRADEWISE_PASSWORD environment variable on the host.")
    if not PASSWORD:
        print("Type the team password (nothing shows while you type), then press Enter.")
        PASSWORD = getpass.getpass("Team password: ")
        # typed blind, so ask again: a typo here locks the whole team out
        if getpass.getpass("Same password again: ") != PASSWORD:
            raise SystemExit("The two passwords don't match. Run the command again.")
    if PASSWORD != PASSWORD.strip():
        raise SystemExit("The password starts or ends with a space. Choose one without.")
    if len(PASSWORD) < 8:
        raise SystemExit(f"Use a password of at least 8 characters (got {len(PASSWORD)}).")
    if not PASSWORD.isascii():
        # some browsers (Safari) send accented letters in a different encoding: it would never match
        raise SystemExit("Use only plain letters, digits and symbols like - _ ! (no accents like è or €).")
    from waitress import serve
    if args.deploy:
        port = int(os.environ.get("PORT", "8000"))
        if not os.environ.get("DATA_DIR"):
            print("Warning: DATA_DIR is not set; test history is lost whenever the host restarts.")
        print(f"GradeWise test site on port {port}, data in {TESTS}")
        serve(app, host="0.0.0.0", port=port, threads=4)
        return
    print(f"GradeWise test site with password: http://127.0.0.1:{args.port}")
    print(f"Now, in a second terminal:  cloudflared tunnel --protocol http2 --url http://localhost:{args.port}")
    # still only listens on this PC: teammates reach it through the tunnel, not the network
    serve(app, host="127.0.0.1", port=args.port, threads=4)


if __name__ == "__main__":
    main()
