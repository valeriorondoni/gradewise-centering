"""Keep the test history in a private Hugging Face dataset.

Free hosts (Hugging Face Spaces, Render free) wipe their disk on every
restart, so the site mirrors webtests/ to a dataset repository:

- at startup, restore() downloads log.csv and every run's results;
- after each test, save_run() uploads that run's folder plus log.csv in one
  commit, in the background so the page doesn't wait for it.

Turned on by two environment variables (set them as Space secrets):
    HF_DATASET  e.g. "your-name/gradewise-tests" (created private if missing)
    HF_TOKEN    a Hugging Face access token with write access to it
Without them every function here does nothing and only the local disk is used.
"""
from __future__ import annotations

import os
import threading

DATASET = os.environ.get("HF_DATASET", "").strip()
TOKEN = os.environ.get("HF_TOKEN", "").strip() or None
_lock = threading.Lock()      # one commit at a time: each one rewrites log.csv


def enabled() -> bool:
    return bool(DATASET)


def restore(local_dir: str) -> None:
    """Download the saved history into local_dir (originals left out to save time)."""
    if not enabled():
        return
    from huggingface_hub import HfApi, snapshot_download
    HfApi(token=TOKEN).create_repo(DATASET, repo_type="dataset", private=True, exist_ok=True)
    snapshot_download(DATASET, repo_type="dataset", local_dir=local_dir, token=TOKEN,
                      ignore_patterns=["*_input.jpg", ".gitattributes"])
    print(f"History restored from dataset {DATASET}")


def save_run(local_dir: str, run_id: str, log_bytes: bytes) -> None:
    """Upload one run's folder and log.csv (as it was right after this run was
    logged), without blocking the request."""
    if not enabled():
        return
    threading.Thread(target=_upload, args=(local_dir, run_id, log_bytes), daemon=True).start()


def _upload(local_dir: str, run_id: str, log_bytes: bytes) -> None:
    from huggingface_hub import CommitOperationAdd, HfApi
    with _lock:
        run_dir = os.path.join(local_dir, run_id)
        ops = [CommitOperationAdd(f"{run_id}/{name}", os.path.join(run_dir, name))
               for name in sorted(os.listdir(run_dir))]
        ops.append(CommitOperationAdd("log.csv", log_bytes))
        try:
            HfApi(token=TOKEN).create_commit(DATASET, ops, repo_type="dataset",
                                             commit_message=f"Test run {run_id}")
        except Exception as e:      # keep the site up; the run is still on the local disk
            print(f"WARNING: could not save run {run_id} to {DATASET}: {e}")
