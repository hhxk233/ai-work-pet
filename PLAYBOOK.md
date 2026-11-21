# Pet playbook: how the DeepSeek pet was built, and how to build the next four

Written for the agents who will make the GPT, Claude, Gemini and Grok pets. It records the method that worked for DeepSeek (大肥鱼, v05), the mistakes that cost a round each, and the order of work. Read it before touching a new character.

## The method in one paragraph

A pet is one deformable layered model for idle and walking, plus a set of whole-figure drawings for everything else. The model breathes, blinks, turns its head and has hair, tail and skirt physics. An action is a timeline of drawn poses, each bound to the same skeleton so it keeps breathing and swaying, and each switch between poses is a hard cut hidden in a small squash. Nothing is ever rotated around an elbow or a shoulder, and two drawings are never cross-faded.

## Rules that came out of failed rounds

Each of these was learned by shipping the opposite and having it rejected.

1. **Arms do not rotate.** Chibi art has no usable shoulder or elbow. Rotating a sleeve layer gave joints the user called ugly twice. If the arms are in a different place, it is a different drawing.
2. **The idle torso and arms come straight from the approved front drawing.** A torso layer with the arms painted out and separate sleeves put the hands "on the chest". Take the torso with its arms from the approved image and only mask out the head.
3. **Pose switches are cuts.** A dissolve between two drawings shows two faces and two hands for a few frames. Cut, and cover the cut with a squash-and-rebound (large between standing and sitting or lying, small otherwise, none when two frames of the same gesture alternate).
4. **Every pose is drawn against a size template.** Without one the image model drifts to taller, thinner figures and the head shrinks on every switch. The template is the approved figure placed twice on a flat green 1536x1024 sheet at a fixed height and position; it is attached to every generation, and a script measures the result.
5. **Within one action only the arms, the prop and the face change.** Hair, dress, tail, feet and head position stay put, and a prop keeps its size and place, otherwise the whole figure jumps on each frame.
6. **Colour comes from the approved drawing only.** Sprites cut from older sheets were lighter (hair crown L 142 against 120). Measure; do not trust the eye across separate images.
7. **Layers hide leftovers at their cut edges.** Where the head was cut out of the body, back hair and frill, strokes of the chin outline stayed behind in three different layers. They are invisible in the rest pose and appear as stray lines once the head moves. Inspect every layer alone on a magenta background, at 4x or more, along every edge another layer normally covers.
8. **A sprite must sit where the model sits.** Standing sprites were 8 px left of the idle model, so every switch nudged her sideways. Measure the offset against the model's head and correct it per sprite.
9. **Judge by looking at frames.** A passing proportion check, a clean build and 60 fps say nothing about whether a line is doubled under the chin. Step the animation, cut strips of frames around each switch, zoom on the face, and look.
10. **When the user says a defect is still there, it is.** Find the pixels before answering. The chin line took three passes because the first two fixed one source and assumed it was the only one.

## Roles

- **The user** approves the character drawing, the action list, each batch of pose art, and anything that becomes public. They look at results, not at reports.
- **The image model (through Codex)** draws: the approved front figure, the layer split, and the pose sheets. It gets a written request with attached reference images and a numeric check to run.
- **The rigging agent** builds the model and motions, cuts and places the sprites, verifies frame by frame, renders previews and the demo, and prepares the web build.
- **Codex on the user's machine** deploys the website. The rigging agent cannot: it has no access to the build scripts' environment or the hosting login.

## Work order for a new character

### 1. Inputs

- An approved front-view drawing of the character at full resolution. This stays private; it is not pushed to the public repository.
- The action list, agreed with the user. DeepSeek has: eat rice, laptop (two variants), think, wave, stretch, hug plush, rest, jump, plus idle, walk and a click reaction.
- Anything the user has said about the character's personality that should show in the actions.

### 2. Template and proportion numbers

Scale the approved figure to 760 px tall and place it twice on a flat #00B140 sheet of 1536x1024, centred at x=384 and x=1152 with the feet at y=915. That is `template_2up.png`. Measure two ratios on it for the checker: head height (top of hair to chin) over standing height, and widest head span over standing height. DeepSeek's are 0.59 and 0.82. Also make a labelled guide and a right-versus-wrong comparison for the person writing prompts; those two are never attached to a generation.

`tools/check_proportions.py` currently hard-codes DeepSeek's span threshold (0.79). Set the threshold per character, a few percent under the template's value.

### 3. Layered idle model

Layers needed, each a transparent PNG placed in a 1024x1024 model space by `tex/manifest.json`: back hair (with the area behind the head filled in), tail or other appendage, legs, torso with arms (from the approved drawing, head masked out), neck patch, head with a blank face, eyes open and closed, mouths. `tools/prep_layers.py` shows how DeepSeek's were assembled; its warp constants and crop boxes are DeepSeek's and must be redone.

Then in `characters/<name>/rig.js`: bones, skin weights, springs for hair, tail, skirt and ears, the head dome deformer for turning, blink and mouth deformers. Copy DeepSeek's file as a starting point and replace every coordinate; the engine in `engine/pet-engine.js` has no character data and should not need changes.

Before going further, run the layer inspection from rule 7, then show the user idle and walking from the front. Shoulders, the chin edge and the neck are where DeepSeek failed review.

### 4. Pose sheets

Write the request the way `art_in/PROMPT_round3.md` is written (in DeepSeek's private project folder, next to the sheets and the `ref/` images; `art_in/` is not in the public repository): what is wrong now, what to attach, hard requirements, one entry per sheet with two figures, and the check command. Things that mattered:

- A path in a prompt attaches nothing. Say which files to attach.
- Two figures per sheet, front view, not overlapping, nothing cropped, flat green edge to edge, every shape closed by its outline, nothing green on the character.
- Give sitting and lying figures a width allowance and say the head stays the template size in every pose.
- List the rejection reasons so the drawer rejects its own bad sheets.
- Keep rejected attempts in a drafts folder; never overwrite an accepted sheet.

When sheets come back: run the checker, put all figures side by side with the idle model at the same scale with guide lines, and look. Show the user the cut-in result, not the raw sheet. One of DeepSeek's sets passed every check and the user still rejected it on taste; a redraw took minutes.

### 5. Cut and place

`tools/cut_green.py <sheets dir> characters/<name>/tex/poses` keys out the green, removes spill, scales by 827/760 (template pixels to model units), anchors standing figures on the feet and writes `poses.json`. Register each sheet in `SHEETS` with a name and kind (stand, sit, lie). The anchor constants (`FEET_X`, `HEAD_X`) and the scale are DeepSeek's.

Then measure each sprite against the idle model: match the top 300 rows of the sprite's silhouette against the model's and read off the horizontal offset. Put corrections in `NUDGE`. Poses with a tilted or lowered head will not match cleanly; align those on the feet or leave them.

### 6. Motions

Each action in `characters/<name>/motions.js` is a clip: a duration, a list of `[time, pose]`, and a function returning small overlays (bob, head tilt, tail wag) so a held drawing still looks alive. Start and end on the model (`'rig'`). Give a held pose something to do: chewing, typing bursts, nodding off.

The director (idle behaviour, walking, clip playback, the pop on a cut) is `engine/director.js` and is shared. A character passes it its clips, its `poses.json` and two optional hooks for motion only that character has: `idle(o, ctx)` adds to the idle parameters (DeepSeek: tail sway, ear twitch, fists riding on the breath) and `walk(ctx)` returns extra walk-cycle parameters. Numbers such as walk speed and breath period go in `tune`. See `characters/deepseek/load.js` for the call. When the director was moved out of DeepSeek's file, 1,200 captured frames were compared before and after and were identical; do the same for any later engine change.

### 7. Verify

- `tools/capture.py <out> <fps> '<script json>'` steps the page deterministically in headless Chrome and writes frames. A script is `{"dur": seconds, "events": [[t, "play:<clip>"], [t, "walk:1"], [t, "halt"]]}`.
- Make a 30 fps check clip of the changed actions first. On the build machine capture runs at roughly 6 to 12 frames per second of wall time, so the full 113 s demo at 60 fps takes about 19 minutes. A defect found after that render costs another 19.
- From the frames, cut strips around each pose switch and zoomed crops of the face, and look at them.
- Send the user the short clip or a zoomed before/after still before starting the long render.

### 8. Package

- `web/`: the same scripts with WebP textures (quality 92 for layers, 90 for pose sprites; DeepSeek's build is 2.7 MB), `widget.js` as a site-wide companion that loads after the page is idle and starts folded on phones and reader pages, and a standalone page. Test it on a throwaway page at desktop and phone widths and read the console.
- Demo video: `demo.html` holds the captions and timings, `tools/make_bgm.py` synthesises the music so there is nothing to license, ffmpeg joins frames and audio. Captions are plain Chinese, one line saying what she does.
- `README.md` in the character folder: what it is, how to run it, known limits stated plainly.

### 9. Publish

The order the user asked for: show the result, then GitHub, then the website, then the demo video.

- GitHub: push a branch to `hhxk233/ai-work-pet`, open a pull request, and let the user merge or say so. Raw sheets, references and the approved drawing stay out of the public repository.
- Website: hand Codex `web/DEPLOY.md`. It replaces one folder in an isolated release copy, builds, previews the real pages, deploys, and backs up. Do not deploy from the mixed working tree, and do not post about it unless the user asks.

## What is reusable and what is not

| Piece | Reuse |
| --- | --- |
| `engine/pet-engine.js` | As is |
| `engine/director.js` | As is; character-specific motion goes in the `idle` and `walk` hooks |
| `rig.js`, `motions.js` (clips and hooks), `load.js` | Copy and replace all coordinates, clips and hooks |
| `tools/capture.py`, `make_bgm.py`, `demo.html`, `web/widget.js` | As is, apart from names, captions and the action list |
| `tools/cut_green.py`, `check_proportions.py` | Same code, new constants per character |
| `tools/prep_layers.py`, `fix_chin.py` | Specific to DeepSeek's layers; read them for the technique |
| `tools/cut_poses.py`, `upscale.py`, `match_colour.py` | Only for sprites salvaged from old sheets; a new character should not need them |

## Known limits carried into the next characters

- Pose switches are cuts, not tweens. This is deliberate.
- Drawn poses cannot blink; the eyes are part of the drawing.
- Eyes do not follow the pointer.
- It is a web page, not a Windows desktop program.

## Lessons from the second character (GPT, 白龙娘, 2026-11-18 to 11-20)

What worked better than on DeepSeek, and what was new. Files are under `characters/gpt/` and `tools/gpt/`.

1. **Start from a drawing the user already approved and published.** Her front drawing is the upper-left chibi of her Live2D sheet, restored once on green by the image tool ("faithful clean-up, not a redesign"). One attempt, approved. Do not ask for a new design when one exists.
2. **Layer plates are whole-figure edits, and they are never pixel-exact.** Ask for five plates (blank face, body only, back hair only, wings and tail only, closed-eye and closed-mouth parts). The tool redraws the whole figure each time, so do not cut a plate against the drawing pixel by pixel: use each plate whole for its own layer and take only the head from the approved drawing (`tools/gpt/cut_layers.py`). `check_plate.py` reports the shift; 0 to 2 px was normal.
3. **Make the pose template from the model at rest, not from the drawing** (`tools/gpt/rest_composite.py`). Then the tool edits the template in place and every standing pose lands on the model within 1 px; no NUDGE table was needed. Ask for a pilot batch of four sheets first.
4. **Figures that cannot be in-place edits** (sitting, lying, crouching, in the air) are marked `free` in `SHEETS`: the cutter puts the lowest point on the ground and lines the horn tips up with the template. Check the head with `head_shift.py` between poses of one action; the sitting laptop poses ended within 3 units.
5. **Measure heads, do not eyeball them.** Ear-tip to ear-tip on the skin was 430 px on the template; two sleeping figures were 394 and 402 and looked "a bit small". Give the drawer the numbers when asking for a fix.
6. **Bind a pose sprite almost rigidly when hair, wings and skirt fill the picture.** DeepSeek's region binding (sides to hair springs, hem to skirt springs, a band to the tail) bent hands, props and frills on her: the user called it jelly. Now a sprite rides the hips, the head nods it at under half weight, the soles stay planted and only the tail-tip curl has its own bones. Measure with `tools/gpt/strain.py` (optical flow between frames, stretch and shear only; rigid motion scores zero), not by eye alone: the worst place in a chewing hold went from 15 to 2. Fast small bobs (chewing, typing) shake springs: keep them small.
7. **Long hair on the model must sway as one mass**: stiff, damped, every strand with the same spring and wind. Strands with different settings drift out of phase and read as jelly too. A wing is one rigid plate turning on its root.
8. **Props with marks**: the image tool drew a company-like logo on the laptop and mug. Name the mark you want (her own knot flower) in the first request.
9. **Opening a laptop** needed its own two-figure sheet (closed on the ground, lid part way up), drawn as an edit of the seated pose. It worked on the second attempt this time because the base was an in-place edit; on DeepSeek it failed twice.
