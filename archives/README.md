# Recovered Block Planet build

`block-planet-recovered-2026-09-04.tar.gz` is a complete checkpoint of the playable version recovered from the 2026-08-20 browser build cache.

Verified features include the survival game, minigames, Tank Battle, 5-vs-5 AI tanks, cannon and machine-gun combat, cannon ammunition, and the rocket launcher.

The 2026-09-06 maintenance update separates the player tank cannon from the stationary field cannon: each now has its own ammo state, consumption callback, reload flow, projectile marker, and HUD message.

SHA-256:

```text
1a0d73df613e7b1bc2a29d7aae2e5c2d216bf3fcd88dbe0dfda3592f1a2c05d5
```

Extract the archive and follow `CURRENT_VERSION_ARCHIVE.md`. Do not rebuild the recovered checkout before preserving `dist/`, because the tracked source history does not contain every recovered feature.

## Render deployment

The repository includes `render.yaml`. Its build command extracts this checkpoint and installs dependencies without running `npm run build`, so the recovered features remain intact.
