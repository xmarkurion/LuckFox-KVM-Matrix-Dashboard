# Configuration backups

The dashboard writes automatic and manual `kvm.config.*.json` snapshots here.

- A backup is created before every configuration save.
- A backup is created before restoring another backup.
- Only the newest 10 JSON backups are kept.
- Backups can be downloaded, restored or deleted from **Settings → Backups**.

Keep this directory mounted into `/app/backups` when running with Docker.
