# BiteSizedUtilities — the whole site, offline

{{FILES}} files, {{EXTRACTED}} extracted, **{{ZIP}}** to download. Built {{BUILT}} from {{SOURCE}}.

This is the entire built site in one archive: every tool, all 51 games, the CodeHub
runtimes, the fonts and icons. {{WEIGHTS_SENTENCE}} It is rebuilt from `main` on
every deploy, so this asset always matches the live site.

## Using it

Unzip it anywhere, then open `START-HERE.html` in a browser. That page works
whether or not the folder is being served, and tells you which of the two you are in.

A browser will not run the site straight off the disk. It refuses an ES module from
a `file:` page, refuses to start a worker from one, and refuses to let one `file:`
page open another — which between them are the kitchen, the code runtimes and every
game. Serve the folder over `http://localhost` and all three refusals stop applying:

| Machine | Do this |
| --- | --- |
| Windows | double-click `start-server.bat` |
| macOS | double-click `start-server.command` |
| Linux | run `sh start-server.sh` in the folder |

Each script needs Python 3, serves the folder to your own machine only, on port
8123, and stops when you close its window. By hand the same thing is:

```
cd path/to/this/folder
python3 -m http.server 8123 --bind 127.0.0.1
```

then open <http://localhost:8123/index.html>. Once it is running, nothing is fetched
from the internet — the model weights are in the folder.

## Two honest caveats

**Threaded WASM runs one thread deep.** Shared-memory threads need cross-origin
isolation headers, which `python -m http.server` cannot send. The site detects that
and drops to a single thread, so the runtimes and Waffle AI still work; some of them
just take longer.

**A phone or tablet cannot do the serving.** There is no local server on a tablet
without a third-party app, so this archive is for a computer. That is a limit of the
device, not of the zip.

## What is inside

| Piece | Size |
| --- | --- |
{{CONTENTS}}

Nothing here is a secret and nothing phones home. Delete the folder to be rid of it:
the only thing it ever writes is your browser's own cache and saved work, which live
in the browser, not in this folder.
