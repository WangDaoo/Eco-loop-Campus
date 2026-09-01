from __future__ import annotations

import argparse
import hashlib
import mimetypes
import shutil
from pathlib import Path

from PIL import Image


def export_samples(source_dir: Path, target_dir: Path, dry_run: bool) -> tuple[int, int]:
    exported = 0
    skipped = 0
    for image in source_dir.rglob("*"):
        if not image.is_file() or image.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        relative_class = image.parent.name.strip()
        if not relative_class:
            skipped += 1
            continue
        try:
            with Image.open(image) as checked:
                checked.verify()
        except Exception:
            skipped += 1
            continue
        digest = hashlib.sha256(image.read_bytes()).hexdigest()[:16]
        extension = image.suffix.lower()
        destination = target_dir / relative_class / f"reviewed-{digest}{extension}"
        if destination.exists():
            skipped += 1
            continue
        if not dry_run:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(image, destination)
        exported += 1
    return exported, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Export reviewed AI images without overwriting dataset files")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.source.is_dir():
        raise SystemExit(f"Source directory not found: {args.source}")
    exported, skipped = export_samples(args.source, args.target, args.dry_run)
    mode = "dry-run" if args.dry_run else "export"
    print(f"{mode}: {exported} files, skipped: {skipped}")


if __name__ == "__main__":
    main()
