from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_VERSION = "0.1.4"
VERSION = "0.1.8"
MIN_APP = "1.6.0"
RELEASED_AT = "2026-08-30"
BASE_DIR = ROOT / "downloads" / "plugin" / BASE_VERSION
OUT_DIR = ROOT / "downloads" / "plugin" / VERSION
PATCH = ROOT / "src" / "private-repo-pull.js"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    base_main = (BASE_DIR / "main.js").read_text(encoding="utf-8")
    patch = PATCH.read_text(encoding="utf-8")
    (OUT_DIR / "main.js").write_text(base_main.rstrip() + "\n\n" + patch.rstrip() + "\n", encoding="utf-8")
    shutil.copyfile(BASE_DIR / "styles.css", OUT_DIR / "styles.css")

    manifest = json.loads((BASE_DIR / "manifest.json").read_text(encoding="utf-8"))
    manifest["version"] = VERSION
    manifest["description"] = "Plan mentorship studies, discover and restore private GitHub Markdown notes, memorize passage summaries, and keep meeting notes."
    write_json(OUT_DIR / "manifest.json", manifest)
    write_json(ROOT / "manifest.json", manifest)

    versions = json.loads((BASE_DIR / "versions.json").read_text(encoding="utf-8"))
    for version in ["0.1.5", "0.1.6", "0.1.7", VERSION]:
        versions[version] = MIN_APP
    write_json(OUT_DIR / "versions.json", versions)
    write_json(ROOT / "versions.json", versions)

    release_files = []
    for name in ["main.js", "manifest.json", "styles.css", "versions.json"]:
        path = OUT_DIR / name
        release_files.append({"name": name, "path": f"downloads/plugin/{VERSION}/{name}", "sha256": sha256(path)})

    release = {
        "schemaVersion": 1,
        "pluginId": "bryte-mentorship",
        "channel": "stable",
        "version": VERSION,
        "minAppVersion": MIN_APP,
        "releasedAt": RELEASED_AT,
        "updateAssetsAvailable": True,
        "files": release_files,
    }
    write_json(ROOT / "downloads" / "plugin-release.json", release)

    zip_entries = ["main.js", "manifest.json", "styles.css", "versions.json"]
    versioned_zip = ROOT / "downloads" / f"bryte-mentorship-{VERSION}.zip"
    latest_zip = ROOT / "downloads" / "bryte-mentorship-latest.zip"
    for target in [versioned_zip, latest_zip]:
        with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for name in zip_entries:
                zf.write(OUT_DIR / name, arcname=f"bryte-mentorship/{name}")

    sums = [
        f"{sha256(versioned_zip)}  {versioned_zip.name}",
        f"{sha256(latest_zip)}  {latest_zip.name}",
    ]
    (ROOT / "downloads" / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
