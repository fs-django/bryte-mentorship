# Verify the Bryte Mentorship download

## Official package

- Version: `0.1.0`
- File: `downloads/bryte-mentorship-0.1.0.zip`
- Stable alias: `downloads/bryte-mentorship-latest.zip`
- SHA-256: `dadf1c815e2944fa5df88911a03b71b9b49212654ad195bc34d52c6518ba9e62`

Both ZIP names contain the same bytes and therefore have the same SHA-256.

## ZIP contents

The archive contains only these Obsidian plugin files:

```text
bryte-mentorship/
├── main.js
├── manifest.json
├── styles.css
└── versions.json
```

## Verify the checksum

### Windows PowerShell

```powershell
Get-FileHash .\bryte-mentorship-0.1.0.zip -Algorithm SHA256
```

### macOS / Linux

```bash
shasum -a 256 bryte-mentorship-0.1.0.zip
```

The result must exactly match:

`dadf1c815e2944fa5df88911a03b71b9b49212654ad195bc34d52c6518ba9e62`

The same values are also published in [`downloads/SHA256SUMS.txt`](downloads/SHA256SUMS.txt).

## Independent third-party verification

You can independently check the exact package with VirusTotal:

1. Verify the ZIP SHA-256 first.
2. Search VirusTotal for that SHA-256, or upload the ZIP if no report exists yet.
3. Confirm the VirusTotal report shows the same SHA-256 before relying on the result.

Direct report address:

`https://www.virustotal.com/gui/file/dadf1c815e2944fa5df88911a03b71b9b49212654ad195bc34d52c6518ba9e62/detection`

A checksum or antivirus scan is evidence, not an absolute guarantee. The purpose of these steps is to let students verify that they received the exact published package and obtain an independent multi-engine security opinion.
