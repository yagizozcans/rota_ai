#!/usr/bin/env python3
"""feed.py — manually push photo(s) into the RotaAI backend.

Until the mobile capture app (Layer 01) exists, this is how you get data into the
system: it does exactly what the phone will eventually do automatically — start a
drive session, then upload each photo with GPS metadata (docs/00-overview.md §4.1
CaptureFrame). The backend queues each one, the AI worker detects signs, and the
results appear in the Review Console.

Pure standard library — no `pip install` needed, just system python3.

Usage:
    python3 tools/feed.py photo.jpg
    python3 tools/feed.py ./my_photos/                 # whole folder
    python3 tools/feed.py photo.jpg --lat 41.015 --lon 28.979
    python3 tools/feed.py ./photos/ --api http://localhost:8000

Each run creates ONE session and uploads all given images into it, nudging the
GPS slightly per photo so they don't all stack on the same map point.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import urllib.request
import uuid
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _post_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def _post_multipart(url: str, fields: dict[str, str], image_path: Path) -> dict:
    """Build a multipart/form-data body by hand (stdlib has no helper for this)."""
    boundary = uuid.uuid4().hex
    content_type = mimetypes.guess_type(str(image_path))[0] or "image/jpeg"
    parts: list[bytes] = []
    for name, value in fields.items():
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        parts.append(f"{value}\r\n".encode())
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        f'Content-Disposition: form-data; name="image"; filename="{image_path.name}"\r\n'.encode()
    )
    parts.append(f"Content-Type: {content_type}\r\n\r\n".encode())
    parts.append(image_path.read_bytes())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)

    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def gather_images(source: Path) -> list[Path]:
    if source.is_file():
        return [source]
    return sorted(p for p in source.rglob("*") if p.suffix.lower() in IMAGE_EXTS)


def main() -> None:
    ap = argparse.ArgumentParser(description="Feed photo(s) into the RotaAI backend")
    ap.add_argument("source", help="an image file or a folder of images")
    ap.add_argument("--api", default="http://localhost:8000", help="backend base URL")
    ap.add_argument("--lat", type=float, default=41.0082, help="starting latitude")
    ap.add_argument("--lon", type=float, default=28.9784, help="starting longitude")
    ap.add_argument("--device", default="feed.py", help="device_id label")
    args = ap.parse_args()

    images = gather_images(Path(args.source))
    if not images:
        sys.exit(f"No images found under {args.source}")

    # 1. Start a drive session (docs/03-backend-api.md §4.1)
    session = _post_json(f"{args.api}/api/v1/sessions", {"device_id": args.device})
    sid = session["session_id"]
    print(f"session started: {sid}  ({len(images)} image(s))")

    # 2. Upload each image as a frame, nudging GPS ~11m north each time
    for i, img in enumerate(images):
        lat = args.lat + i * 0.0001
        lon = args.lon
        capture_frame = {
            "session_id": sid,
            "device_id": args.device,
            "gps": {"lat": lat, "lon": lon, "accuracy_m": 3.0, "speed_kmh": 40},
            "heading_deg": 0.0,
        }
        try:
            res = _post_multipart(
                f"{args.api}/api/v1/frames",
                {"metadata": json.dumps(capture_frame)},
                img,
            )
            print(f"  [{i + 1}/{len(images)}] {img.name} -> frame {res['frame_id']} (queued)")
        except Exception as e:  # noqa: BLE001
            print(f"  [{i + 1}/{len(images)}] {img.name} -> FAILED: {e}")

    # 3. Close the session
    _post_json(f"{args.api}/api/v1/sessions/{sid}/complete", {})
    print("session complete. The AI worker is now processing — check the Review Console.")


if __name__ == "__main__":
    main()
