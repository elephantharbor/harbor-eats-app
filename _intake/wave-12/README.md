# TEMPORARY intake — Wave-12 certified packages (do not merge to main)

This path exists only on branch `intake/wave-12-packages` to carry the 25
Vale-certified Wave-12 packages (25/25 PASS, kitchen_tested false) to the
integration agent byte-for-byte. The integration PR must be built on a fresh
branch off `main` and must NOT include `_intake/`.

- `packages/<slug>/` — certified package dirs exactly as frozen (v1.json, images, audits, briefs, rejected/).
- `wave-12-certified.tgz` — same content as a tarball (+ `.sha256`).
- `SHA256SUMS` — sha256 of every file under packages/, WAVE.json, notes/ (`sha256sum -c SHA256SUMS` from this dir).
- Freeze Integrity re-run on scratch copies 2026-10-08 ~17:30 CT: 25/25 PASS.
