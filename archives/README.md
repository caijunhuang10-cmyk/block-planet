# Recovered Block Planet build

`block-planet-recovered-2026-09-04.tar.gz` is a complete checkpoint of the playable version recovered from the 2026-08-20 browser build cache.

Verified features include the survival game, minigames, Tank Battle, 5-vs-5 AI tanks, cannon and machine-gun combat, cannon ammunition, and the rocket launcher.

SHA-256:

```text
d8fdd1abaac85d28dea33333be3680fb53020987f11853f7dcbe1a74e062cd5e
```

Extract the archive and follow `CURRENT_VERSION_ARCHIVE.md`. Do not rebuild the recovered checkout before preserving `dist/`, because the tracked source history does not contain every recovered feature.

## Render deployment

The repository includes `render.yaml`. Its build command extracts this checkpoint and installs dependencies without running `npm run build`, so the recovered features remain intact.
