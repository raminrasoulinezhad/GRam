# Clearing the exercise imagery

**The problem in one line:** the photographs the app shows come from a dataset whose maintainer
never said where he got them, and a public-domain dedication cannot cover material he did not
own. That is tolerable for a hobby project that links rather than copies. It is not tolerable
once the app asks anyone for money.

This document is the plan to replace them with artwork this project owns outright, and the
record of what was ruled out and why.

> **Nothing in the app changes yet.** Everything here is tooling and evaluation. The app keeps
> behaving exactly as it does now until the artwork is good enough to swap in.

---

## 1. What is actually wrong

| | |
|---|---|
| Where they come from | [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), released under the Unlicense |
| What that covers | What the maintainer wrote. Not photographs he did not shoot. |
| What the README says about the images | Nothing. It credits an upstream dataset and a favicon. |
| Who asked | [Issue #2](https://github.com/yuhonas/free-exercise-db/issues/2), closed with no reply. [Issue #12](https://github.com/yuhonas/free-exercise-db/issues/12), the same. |
| How many are affected | 873 of 896 exercises carry photograph paths |
| How the app uses them | Stores the path, the phone fetches the file from `raw.githubusercontent.com` at runtime |

The chain of title is broken at the first link. Nobody can produce a licence because nobody has
one.

**The best argument available today is that the repository copies nothing:** it holds paths, and
the device fetches the files. That argument is real and it is weaker than it sounds. Inline
linking is unsettled in the US (*Perfect 10* permitted it, *Goldman v. Breitbart* did not), and
in the EU it turns on whether the linker knew the source was unauthorised. This repository has
it written down that we know. Adding a donation button makes the use commercial, which is the
factor most likely to tip it.

### The same defect, in the text

`instructions` came from the same dataset with the same broken chain of title, and the prose is
expressive rather than functional:

> "Using a medium width grip (a grip that creates a 90-degree angle in the middle of the
> movement between the forearms and the upper arms)..."

It has to be dealt with in the same pass. The structured fields are fine: names, muscles and
equipment are facts.

### Everything else in the repo is clean

Checked: all 24 runtime dependencies are MIT and gated by `npm run licenses`; system fonts only,
no bundled webfont; Ionicons via `@expo/vector-icons`, MIT; coach videos are external links, never
embedded; `MuscleGlyph.tsx` is ours. One thing to confirm: nothing records who made
`assets/brand/icon-source.png`.

---

## 2. Ruled out, and why

**Filtering, cartooning or "converting" the existing images.** This is the tempting one and it
does not work. A stylised version of their photograph is a **derivative work**, and preparing
derivative works is one of the exclusive rights of the copyright holder. More pipeline stages do
not help: a derivative of a derivative still traces back, and the pipeline itself is evidence of
where you started. Rotation and mirroring are legally nothing.

**A loop that converges on the original.** Worse than the above. An optimiser whose objective is
"minimise the difference between my output and their image" is, in code, an optimiser for
substantial similarity, which is the legal test itself. It also needs their file present at every
iteration. The better it works, the more infringing it gets.

**Wikimedia Commons as the primary source.** Not a licensing problem, a content one. For three
sample exercises it returned an empty bench with no lifter (CC0), a cropped torso that never
shows the movement, and a stability-ball crunch filed against a plain floor crunch. Different
person, gym and crop every time.

**Buying a commercial set.** Clean, and the licence almost certainly forbids redistribution,
which a public Apache-2.0 repository cannot accommodate without hosting the files off-repo.

**Shipping on the muscle glyphs alone.** Zero risk, zero cost, and rejected: real imagery is a
requirement.

---

## 3. The plan

Generate the set from **text**, never from their pixels. The reference is a written spec of how
the movement is performed, derived from catalog facts. How a bench press works is a procedure,
and procedures sit outside copyright.

```
spec  ->  generate  ->  score against spec  ->  amend prompt  ->  accept
```

The loop asks *"is this a correct depiction of this spec"*, never *"is this close to their
picture"*. Same convergence behaviour; the target was the only thing that was ever wrong.

### The model licence matters as much as the provider

**FLUX.1-schnell is Apache 2.0** and explicitly permits commercial use. **FLUX.1-dev is
non-commercial**, is the better-looking model, and is the default in half the tutorials online.
Reaching for it would recreate the exact problem being solved. Every provider below is pinned to
schnell for that reason.

### Three providers, in the order to try them

| Order | Provider | Free allowance | Notes |
|---|---|---|---|
| 1 | **Cloudflare Workers AI** | 10,000 neurons/day; schnell is 4.8 per 512x512 tile, so roughly **2,000 images a day** | The whole catalog fits in one day's allowance. Confirm the service terms for commercial use yourself. |
| 2 | **Hugging Face Inference** | ~1,000 requests/day | Same model, same licence position. Good spillover. |
| 3 | **Local, on the RTX 3050** | unlimited | Free retries, ~1 to 2 min/image. 6GB VRAM needs a quantised build. Best home for the stubborn tail. |
| fallback | Gemini image | none, $0.039/image | Best prompt adherence. Only for what the free three cannot get right. |

**Spec writing and scoring always run on Gemini's free text and vision tier**, whichever provider
renders the image. Only Gemini's *image* generation costs money. So Cloudflare plus Gemini
scoring is a pipeline that costs nothing at all.

### Expected quality trade

FLUX-schnell is a 4-step distilled model: fast, and weaker than Gemini on complex anatomy.
Exercise poses are the hard case, so expect a higher rejection rate. That is what the loop and
the fallback tiers are for.

### The fallback chain, once the set exists

| Tier | Source | Licence |
|---|---|---|
| 1 | Generated, review passed | Ours, no conditions |
| 2 | Everkinetic via wger | CC BY-SA 3.0, credited |
| 3 | `MuscleGlyph`, already shipped | Ours, Apache 2.0 |

Tier 2 is line art, so it is a floor rather than a goal. Tier 3 already serves 23 exercises today
and nobody has noticed.

---

## 4. Running it

```bash
export GEMINI_API_KEY=...          # free tier; spec writing and scoring
export CLOUDFLARE_ACCOUNT_ID=...   # dash.cloudflare.com, right-hand sidebar
export CLOUDFLARE_API_TOKEN=...    # profile > API tokens, with Workers AI read

npm run art -- --provider cloudflare --probe    # one image, see the house style
npm run art -- --provider cloudflare --limit 10 # the trial
npm run art:sheet                               # side-by-side review page
```

Then open `assets/generated/review.html`. It puts every exercise in a row and every provider in a
column, start frame beside end frame, so the comparison is the point rather than an afterthought.

Repeat with `--provider huggingface` (needs `HF_TOKEN`) and the same ten exercises. The review
page picks up each new provider automatically.

**Judge the style before generating anything at scale.** If it does not hold across a squat, a
cable fly and a plank, the fix is the `STYLE` paragraph in
[`scripts/build-exercise-art.mjs`](../scripts/build-exercise-art.mjs) and nothing else.

### Running locally on the RTX 3050

6GB of VRAM will not hold FLUX-schnell at full precision. Use a quantised GGUF build under
ComfyUI, or `diffusers` with sequential CPU offload, and expose a tiny HTTP endpoint that takes
`{"prompt": "..."}` and returns the image. Then:

```bash
export LOCAL_IMAGE_URL=http://127.0.0.1:8188/generate
npm run art -- --provider local --limit 10
```

System RAM is the tighter constraint here, not VRAM: offloading needs somewhere to put the
weights, and this machine has about 5GB free.

---

## 5. Order of work

1. **Quality first.** Ten exercises through Cloudflare, then Hugging Face, then local. Compare on
   the review page. Nothing else starts until the artwork is worth shipping.
2. Generate the head of the catalog, the 200 exercises people actually log, and check every frame
   by eye.
3. Fill gaps from the Everkinetic tier, recording `license`, `license_author` and
   `license_derivative_source_url` per file.
4. Generate the tail; accept a lower hit rate; glyph the remainder.
5. Only then touch the app: swap the image source, add the credits screen, rewrite
   `THIRD-PARTY-NOTICES.md` §2, and repoint `src/__tests__/notices.test.ts` at the new claims.
6. Deal with `instructions` in the same pass.

---

*Not legal advice. This is an engineering assessment of where the material came from and what it
would take to replace it. For a project that will take money, a short conversation with a
solicitor about the linking question is cheap insurance.*
