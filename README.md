# Bryte Mentorship

Public distribution for Bryte Mentorship curriculum and the ready-to-install Obsidian plugin.

## Install the plugin

1. Download [`downloads/bryte-mentorship-latest.zip`](downloads/bryte-mentorship-latest.zip).
2. Unzip the `bryte-mentorship` folder into your Obsidian vault at `.obsidian/plugins/`.
3. In Obsidian, open **Settings → Community plugins** and enable **Bryte Mentorship**.
4. Open Bryte Mentorship and choose **Pull assignments**.

No compiling, Node.js, or npm is required.

## Plugin updates

Starting with Bryte Mentorship **0.1.4**, the plugin can check the public Stable release feed for newer plugin versions from inside Obsidian.

- Startup update checks are enabled by default and are rate-limited.
- A startup check never installs executable code silently.
- Use **Bryte Mentorship: Check for plugin update** to check immediately.
- Use **Bryte Mentorship: Install Bryte Mentorship update** or **Update now** in plugin settings to install a verified update.
- Restart Obsidian after an update is installed.

Users already running a version older than 0.1.4 need to install 0.1.4 (or a later version) once through the normal ZIP install path. After that bootstrap update, future Stable releases can be discovered and installed from inside the plugin.

## Released curriculum

The public assignment feed currently contains:

- **Unit 1 — Genesis Foundations**
- **Unit 2 — Patriarchs and Exodus**

The curriculum feed is available under [`assignments/`](assignments/).

## Privacy

This repository is for public curriculum and release files only. Do not place personal or participant information in this repository.

Plugin software update checks use only the public release feed. Student notes, meeting information, flashcard review history, and private GitHub credentials are not part of the public plugin update request.

## Verify the download

Published SHA-256 checksums are in [`downloads/SHA256SUMS.txt`](downloads/SHA256SUMS.txt). See [`SECURITY-VERIFY.md`](SECURITY-VERIFY.md) for checksum instructions and independent VirusTotal verification.
