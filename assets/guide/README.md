# Guide expressions

Drop the illustrated portraits here with these exact names. Square WebP (640 by 640 is plenty),
same crop and backdrop for all seven so the swap reads as one person reacting.

| file            | expression                       | used when                             |
|-----------------|----------------------------------|---------------------------------------|
| calm.webp        | calm, slight closed-mouth smile  | default, resting, narration           |
| warm.webp        | warm open smile                  | greeting, approval, reassurance       |
| attentive.webp   | neutral, listening               | waiting on a choice, reading input    |
| serious.webp     | direct, focused, no smile        | facts, proof, credentials             |
| surprised.webp   | eyebrows up, mouth open          | reveals, "here is the part nobody sees" |
| laugh.webp       | big open laugh                   | jokes, the double meaning             |
| wink.webp        | one eye closed, smile            | playful asides, skip the jargon       |

`guide.js` falls back to `calm.webp` for any missing file, and to the real headshot
if `calm.webp` is missing too, so the site never breaks on a partial set.

Then list the files that exist in `faces.json`, for example `["calm","warm","attentive","serious","surprised","laugh","wink"]`. The guide only requests the faces named there and falls back to the headshot for the rest.
