# BiteSizedUtilities — the whole site, offline

{{FILES}} files, {{EXTRACTED}} extracted, **{{ZIP}}** to download. Built {{BUILT}} from {{SOURCE}}.

This is the entire built site in one archive: every tool, all 51 games, the CodeHub
runtimes, the fonts and icons. {{WEIGHTS_SENTENCE}} It is rebuilt from `main` on
every deploy, so this asset always matches the live site.

## Using it

Unzip it anywhere and **double-click `index.html`. That is the kitchen** — nothing to
install, no terminal, no server, no account. The folder ships a second copy of the
kitchen built as a *classic* script, which is the one kind of script a browser will
run from a page opened off the disk, and `index.html` picks between the two: the
folder build when it was double-clicked, the real module app when the folder is being
served.

`START-HERE.html` is the explanation, not the entrance — read it if something refuses
to work and you want to know why.

## What a folder will and will not run

A page opened off the disk gets an origin the browser will not trust. From one it
refuses an ES module, refuses to start a worker, and refuses a fetch of the file
sitting next to it. The folder build works around the first; the other two are why
some pieces stay asleep until the folder is served:

| From a folder | Works? | Why |
| --- | --- | --- |
| The kitchen, and all 115 utilities on its shelves | yes | that is what `kitchen.js` is for |
| 85 of them — the maths, science, text, art, music and video cupboards | yes | those six never touch the network or a worker |
| The games cupboard, listing all 51 games | yes | its catalog is bundled, not fetched |
| 26 of those games, on tap | yes | a whole game in one page, nothing else to read |
| The whole English &amp; Languages cupboard, all 15 | no | 14 ask Waffle AI, and the translator calls an API |
| The other 25 games | no | they read their own files as they load |
| CodeHub, JavaScript and Web — the rest of that cupboard is in the 85 | no | these three run your code in a worker |
| Waffle AI, and the images it makes | no | the engines load as modules and use workers |

None of that is a broken download and there is no setting to flip. The sleeping pieces
say so rather than failing quietly.

## Waking the rest: one double-click, optional

Serving the folder over `http://localhost` lifts all three refusals at once, and the
same `index.html` then loads the full site:

| Machine | Do this |
| --- | --- |
| Windows | double-click `start-server.bat` |
| macOS | double-click `start-server.command` |
| Linux | run `sh start-server.sh` in the folder |

Each script needs Python 3, serves the folder to your own machine only, on port 8123,
and stops when you close its window. By hand the same thing is:

```
cd path/to/this/folder
python3 -m http.server 8123 --bind 127.0.0.1
```

then open <http://localhost:8123/index.html>. Once it is running, nothing is fetched
from the internet — the model weights are in the folder. **None of this is required to
use the kitchen**; it is the price of the parts a browser will not run off the disk.

## Three honest caveats

**Threaded WASM runs one thread deep.** Shared-memory threads need cross-origin
isolation headers, which `python -m http.server` cannot send. The site detects that
and drops to a single thread, so the runtimes and Waffle AI still work; some of them
just take longer.

**A phone or tablet cannot run the local server** without a third-party app. It can
still open `index.html` and get the kitchen and the games that work from a folder —
but a tablet's file manager chooses which browser opens it, and some of those refuse
local files outright. If the archive came from the site you were already visiting, the
site's own offline mode is the better route there: visit once while online and it keeps
working after.

**This archive is a snapshot.** It is rebuilt on every deploy, so a folder this old may
be behind the live site. Nothing in it phones home to check.

## What is inside

| Piece | Size |
| --- | --- |
{{CONTENTS}}

Nothing here is a secret and nothing phones home. Delete the folder to be rid of it:
the only thing it ever writes is your browser's own cache and saved work, which live
in the browser, not in this folder.
