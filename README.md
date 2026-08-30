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

## Student saved repository

Bryte Mentorship can restore student-owned work from the private GitHub repository already configured in plugin settings.

Configure **Repository owner**, **Repository name**, **Branch**, **Path prefix**, and a fine-grained token limited to that student repository with **Contents read/write** access. The plugin continues to use the public repository for released curriculum and the student's configured repository for their own saved work.

By default, **Pull assignments** restores saved student work first, then installs or updates the released curriculum. You can disable this behavior with **Pull saved work with assignments**, or run **Bryte Mentorship: Pull student work from private GitHub repository** / **Pull saved work** at any time.

Saved-repository restore recognizes the existing coursework paths under the configured prefix:

- `Bryte Mentorship/Studies/`
- `Bryte Mentorship/Meetings/`
- `Bryte Mentorship/Study Plans/`

It also restores Markdown notes from a repository-root `notes/` (or `Notes/`) directory. The subfolder structure is preserved in the vault under `Bryte Mentorship/Notes/`. For example, `notes/books/Revitalize - Chapters 1-3.md` becomes `Bryte Mentorship/Notes/books/Revitalize - Chapters 1-3.md`.

Missing files are restored to the normal vault paths. Matching files are left unchanged. If a local file differs from the GitHub copy, the local file is preserved and the remote copy is written under `Bryte Mentorship/Recovered from GitHub/` for review instead of silently overwriting student work. Restored study frontmatter also restores the assignment status used by the dashboard.

## Released curriculum

The public assignment feed currently contains:

- **Unit 1 — Genesis Foundations**
- **Unit 2 — Patriarchs and Exodus**

The curriculum feed is available under [`assignments/`](assignments/).

## Privacy

This repository is for public curriculum and release files only. Do not place personal or participant information in this repository.

Plugin software update checks use only the public release feed. Student notes, meeting information, flashcard review history, and private GitHub credentials are not part of the public plugin update request. Access to a student's private repository is made directly from that student's Obsidian plugin with the repository-scoped token they configure.

## Verify the download

Published SHA-256 checksums are in [`downloads/SHA256SUMS.txt`](downloads/SHA256SUMS.txt). See [`SECURITY-VERIFY.md`](SECURITY-VERIFY.md) for checksum instructions and independent VirusTotal verification.
