#!/usr/bin/env python3
import argparse
import importlib.util
import json
import pathlib
import sys


ROOT_DIR = pathlib.Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT_DIR / "server.py"


def load_server_module():
    spec = importlib.util.spec_from_file_location("lexicon_sprint_server", SERVER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(
        description="Migrate cloud sync accounts and saved learning state from sqlite to Upstash Redis REST."
    )
    parser.add_argument(
        "--sqlite-path",
        default="",
        help="Path to the source cloud-sync sqlite file. Defaults to the backend's current cloud sync database path.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scan and compare records without writing anything to Upstash.",
    )
    args = parser.parse_args()

    server = load_server_module()
    sqlite_path = args.sqlite_path or str(server.CLOUD_SYNC_DB_FILE)
    summary = server.migrate_sqlite_cloud_sync_to_upstash(sqlite_path=sqlite_path, dry_run=args.dry_run)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
