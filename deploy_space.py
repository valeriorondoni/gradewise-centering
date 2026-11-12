"""Deploy the test site to a Hugging Face Space.

    python deploy_space.py --space your-name/gradewise-test

Uploads only what the site needs (the Python files, requirements.txt, the
Dockerfile and space/README.md as the Space's README) in one commit, and
removes Python files that no longer exist here. Samples, results and tests
photos stay out: Spaces refuse plain binary files and don't need them.

Authentication: the HF_TOKEN environment variable (a token with write access
to the Space), or a previous `hf auth login`. The GitHub workflow in
.github/workflows/deploy-space.yml runs this on every push to main.
"""
from __future__ import annotations

import argparse
import glob
import os

from huggingface_hub import CommitOperationAdd, CommitOperationDelete, HfApi

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["Dockerfile", "requirements.txt"]


def main(argv=None):
    ap = argparse.ArgumentParser(description="Deploy the test site to a Hugging Face Space")
    ap.add_argument("--space", default=os.environ.get("HF_SPACE"),
                    help="Space id, e.g. your-name/gradewise-test (or set HF_SPACE)")
    args = ap.parse_args(argv)
    if not args.space:
        raise SystemExit("Give the Space id with --space or the HF_SPACE variable.")

    api = HfApi(token=os.environ.get("HF_TOKEN") or None)
    local_py = sorted(os.path.basename(p) for p in glob.glob(os.path.join(HERE, "*.py")))
    ops = [CommitOperationAdd(name, os.path.join(HERE, name)) for name in FILES + local_py]
    ops.append(CommitOperationAdd("README.md", os.path.join(HERE, "space", "README.md")))
    remote = api.list_repo_files(args.space, repo_type="space")
    ops += [CommitOperationDelete(name) for name in remote
            if name.endswith(".py") and "/" not in name and name not in local_py]

    info = api.create_commit(args.space, ops, repo_type="space",
                             commit_message="Deploy from GitHub")
    print(f"Deployed to https://huggingface.co/spaces/{args.space} ({info.oid[:7]})")


if __name__ == "__main__":
    main()
