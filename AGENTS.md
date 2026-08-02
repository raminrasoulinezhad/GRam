# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

---

## Versioning and tagging

**Commit each feature as it lands.** One finished piece of work, one commit — don't sit on a
green tree waiting to be told.

**Every commit bumps the version and is tagged.** No exceptions, including documentation-only
commits — the tag history is how a device's version is traced back to a state of the code.

| Asked for | What changes |
|---|---|
| nothing said (the default) | **patch** — `1.2.0` → `1.2.1` |
| "minor" | **minor**, patch reset to zero — `1.2.7` → `1.3.0` |
| "major" | **major**, minor and patch reset to zero — `1.3.4` → `2.0.0` |

The version lives in **both** `package.json` and `app.json`, and a test fails if they disagree.

**Push only on a minor or major bump.** Every push triggers a Netlify build, and builds cost
credits, so patch commits accumulate on the local `main` and ride out with the next minor or
major. Pushing then carries the whole run of them — branch *and* every tag made since the last
push:

```bash
# a patch: commit and tag, and stop there
git commit -m "..."
git tag -a v1.2.7 -m "..."

# a minor: same, then ship everything that has piled up behind it
git push origin main --follow-tags
```

Ramin can always ask for a push out of band; the rule is about what happens unprompted.

## What a minor bump additionally requires

The exercise recommendations in [`src/catalog/recommended.ts`](src/catalog/recommended.ts) carry
a `RECOMMENDED_REVIEWED_FOR` stamp holding a **minor series** — `"1.2"`, not `"1.2.0"`. A test
requires it to equal the major.minor of `package.json`, so a minor bump fails the suite until
the picks have been revisited. Patch releases in between do not, deliberately: a prompt on every
commit is a prompt nobody reads. See
[docs/RELEASING.md](docs/RELEASING.md#re-reviewing-the-exercise-recommendations).

## The rule that outranks all of the above

**A user upgrading from any previous version keeps every plan and every logged set.** If the
stored shape changes, `SCHEMA_VERSION` goes up by one, a migration step is added, and a fixture
of the old payload is added to the migration tests. Never edit an existing migration step.

Four identifiers still say `fitram` after the rebrand and must not be renamed — the storage key,
the bundle id, the `FitRam_` exercise-id prefix, and the EAS slug. Each is load-bearing and each
is documented in
[docs/RELEASING.md](docs/RELEASING.md#names-that-kept-fitram-through-the-rebrand).

## Before every commit

```bash
npm run typecheck && npm test
```
