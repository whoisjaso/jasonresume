# Guide expressions

Drop the illustrated portraits here with these exact names. Square PNG or WebP,
same crop and backdrop for all seven so the swap reads as one person reacting.

| file            | expression                       | used when                             |
|-----------------|----------------------------------|---------------------------------------|
| calm.png        | calm, slight closed-mouth smile  | default, resting, narration           |
| warm.png        | warm open smile                  | greeting, approval, reassurance       |
| attentive.png   | neutral, listening               | waiting on a choice, reading input    |
| serious.png     | direct, focused, no smile        | facts, proof, credentials             |
| surprised.png   | eyebrows up, mouth open          | reveals, "here is the part nobody sees" |
| laugh.png       | big open laugh                   | jokes, the double meaning             |
| wink.png        | one eye closed, smile            | playful asides, skip the jargon       |

`guide.js` falls back to `calm.png` for any missing file, and to the real headshot
if `calm.png` is missing too, so the site never breaks on a partial set.

Then list the files that exist in `faces.json`, for example `["calm","warm","attentive","serious","surprised","laugh","wink"]`. The guide only requests the faces named there and falls back to the headshot for the rest.
