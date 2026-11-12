"""Share the test history through a private GitHub repository.

Everyone runs the site on their own PC; webtests/ is a git clone of the team's
results repository (named in results_repo.txt). After each test the site
commits that test's folder and pushes it; at startup and on "Refresh" it pulls
everyone else's tests.

Why this can't conflict: every test is a new folder with a unique name
(timestamp + random suffix), and log.csv is NOT shared - each PC rebuilds it
from the run.json files. So two people pushing at the same time only ever add
different files, and a rebase onto the other person's commit always succeeds.

Needs Git for Windows (git on the PATH), which brings Git Credential Manager:
the first fetch opens a GitHub sign-in window, after that it's remembered.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import threading
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "results_repo.txt")
GIT = os.environ.get("GRADEWISE_GIT") or shutil.which("git")
IGNORE = "# rebuilt on every PC from the run.json files\nlog.csv\nlog_old_*.csv\n"
AUTHOR_EMAIL = "gradewise-tests@users.noreply.github.com"

_lock = threading.Lock()          # one git operation at a time
status = {"state": "local", "message": "", "time": ""}


def repo_url() -> str:
    url = os.environ.get("GRADEWISE_RESULTS_REPO", "").strip()
    if not url and os.path.exists(CONFIG):
        with open(CONFIG, encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip() and not l.lstrip().startswith("#")]
        url = lines[0] if lines else ""
    return url


def enabled() -> bool:
    return bool(repo_url()) and bool(GIT)


def _set(state: str, message: str):
    status.update(state=state, message=message, time=datetime.now().strftime("%H:%M"))


def _git(folder: str, *args: str, check: bool = True, timeout: int = 180) -> subprocess.CompletedProcess:
    r = subprocess.run([GIT, "-C", folder, *args], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    if check and r.returncode:
        lines = (r.stderr or r.stdout).strip().splitlines()
        raise RuntimeError(lines[-1] if lines else f"git {args[0]} failed")
    return r


def _has(folder: str, ref: str) -> bool:
    return _git(folder, "rev-parse", "--verify", "--quiet", ref, check=False).returncode == 0


def setup(folder: str) -> None:
    """Make `folder` a clone of the results repository and pull the team's tests.
    Tests already in the folder (from before sharing was set up) are kept and uploaded."""
    url = repo_url()
    if not url:
        _set("local", "Results are saved only on this PC: no results repository in results_repo.txt.")
        return
    if not GIT:
        _set("error", "Git is not installed, so results can't be shared. Install Git for Windows "
                      "(see README) and restart the site.")
        return
    os.makedirs(folder, exist_ok=True)
    if not os.path.isdir(os.path.join(folder, ".git")):
        _git(folder, "init", "-q", "-b", "main")
        _git(folder, "remote", "add", "origin", url)
    elif _git(folder, "remote", "get-url", "origin", check=False).stdout.strip() != url:
        _git(folder, "remote", "set-url", "origin", url)
    with open(os.path.join(folder, ".gitignore"), "w", encoding="utf-8", newline="\n") as f:
        f.write(IGNORE)
    sync(folder, "Tests saved before sharing was set up")


def sync(folder: str, message: str = "Sync", author: str = "") -> bool:
    """Commit local tests, put them on top of the team's, push. True when it worked."""
    if not enabled() or not os.path.isdir(os.path.join(folder, ".git")):
        return False
    with _lock:
        _set("syncing", "Uploading and downloading tests…")
        try:
            _git(folder, "fetch", "-q", "origin")
            remote = _has(folder, "refs/remotes/origin/main")
            if remote and not _has(folder, "HEAD"):
                # first time on this PC: adopt the team's history, keep local files as they are
                _git(folder, "reset", "-q", "origin/main")
                if _git(folder, "ls-files").stdout.strip():
                    _git(folder, "checkout", "--", ".")
            _git(folder, "add", "-A")
            if _git(folder, "diff", "--cached", "--quiet", check=False).returncode:
                name = f"GradeWise ({author})" if author else "GradeWise"
                _git(folder, "-c", f"user.name={name}", "-c", f"user.email={AUTHOR_EMAIL}",
                     "commit", "-q", "-m", message)
            if remote and _has(folder, "HEAD"):
                r = _git(folder, "-c", "user.name=GradeWise", "-c", f"user.email={AUTHOR_EMAIL}",
                         "rebase", "-q", "origin/main", check=False)
                if r.returncode:
                    _git(folder, "rebase", "--abort", check=False)
                    raise RuntimeError("could not combine with the team's tests: "
                                       + (r.stderr or r.stdout).strip().splitlines()[-1])
            if _has(folder, "HEAD"):
                _git(folder, "push", "-q", "-u", "origin", "main")
            _set("ok", "Shared with the team.")
            return True
        except (RuntimeError, subprocess.TimeoutExpired) as e:
            _set("error", f"Not shared yet (it will retry on the next test or Refresh): {e}")
            return False


def save_run(folder: str, run_id: str, author: str) -> None:
    """Upload a new test in the background, so the page doesn't wait for GitHub."""
    if enabled():
        threading.Thread(target=sync, args=(folder, f"Test {run_id}" + (f" by {author}" if author else ""),
                                            author), daemon=True).start()
