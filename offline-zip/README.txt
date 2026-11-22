BiteSizedUtilities — the whole site, offline
============================================

{{FILES}} files, {{EXTRACTED}} extracted. Built {{BUILT}} from {{SOURCE}}.


START HERE: DOUBLE-CLICK index.html
-----------------------------------
That opens the kitchen. Nothing to install, no terminal to open, no server to
start, no account to make. The folder carries its own copy of the kitchen built
the one way a browser will still run off the disk, and index.html decides which
copy to start.

START-HERE.html is the same information as this file, as a page. It is the
explanation, not the entrance.


WHAT WORKS FROM THE FOLDER, AND WHAT DOES NOT
---------------------------------------------
Works      the kitchen, and all 115 utilities on its shelves
Works      85 of them — the maths, science, text, art, music and video
           cupboards, which never touch the network or a worker
Works      the games cupboard, listing all 51 games
Works      26 of those games, on tap
Does not   the whole English & Languages cupboard: 14 of its 15 tools ask
           Waffle AI, and the translator calls an API
Does not   the other 25 games, which read their own files as they load
Does not   CodeHub, JavaScript and Web, which run your code in a worker;
           the rest of that cupboard is among the 85
Does not   Waffle AI, or the images it makes

A page opened off the disk gets an origin the browser will not trust, and from
one it refuses three things:

  1. an ES module                  — which is how the full site loads
  2. a worker                      — which is how the runtimes execute anything
  3. a fetch of the file beside it — which is how the 25 games load their parts

None of that is a broken download and there is no setting to flip; it is the
same rule everywhere, for every site. The folder build works around the first,
which is why the kitchen opens at all. The other two are why a few things stay
asleep — and they say so rather than failing quietly.

A page served over http:// is subject to none of the three.


IF YOU WANT THE REST: ONE DOUBLE-CLICK, OPTIONAL
------------------------------------------------
  Windows    double-click  start-server.bat
  macOS      double-click  start-server.command
  Linux      run           sh start-server.sh

Each needs Python 3, which macOS and most Linux installs already have and
Windows gets from python.org. Each serves this folder to your own machine only,
on port 8123, and stops when you close its window. Then open

  http://localhost:8123/index.html

and the same index.html loads the full site instead of the folder build: all 51
games, the runtimes, and Waffle AI running on the model weights in this folder
{{WEIGHTS}} — with nothing fetched from the internet.

By hand, the same thing is

  cd path/to/this/folder
  python3 -m http.server 8123 --bind 127.0.0.1

None of this is required to use the kitchen. It is the price of the parts a
browser will not run off the disk.


WHAT IS IN HERE
---------------
  index.html        the kitchen, and the few lines that decide how to start it
  kitchen.js        the folder build: the whole kitchen as one classic script
  kitchen.css       its styles
  START-HERE.html   this, as a page
  start-server.*    the optional local server, one per operating system
  115 utilities     maths, writing, art, music, video, code
  51 games          each its own page
  CodeHub runtimes  Python, JavaScript, Bash, Luau, Befunge
  Waffle AI         {{WEIGHTS}}
  the site itself   every script, style, font, icon and runtime binary it serves


THREE HONEST CAVEATS
--------------------
Threaded WASM will run one thread deep. Shared-memory threads need cross-origin
isolation headers, which python's http.server cannot send. The site detects that
and drops to a single thread, so the runtimes and Waffle AI still work — some of
them just take longer.

A phone or tablet cannot run the local server without a third-party app. It can
still open index.html and get the kitchen and the games that work from a folder
— but a tablet's file manager chooses which browser opens it, and some of those
refuse local files outright. If this folder came from the site you were already
visiting, the site's own offline mode is the better route there: visit it once
while online and it keeps working after.

This folder is a snapshot. The zip is rebuilt on every deploy of the site, so a
folder this old may be behind the live one. Nothing in it phones home to check.


IF YOU DID NOT MEAN TO KEEP IT
------------------------------
Delete the folder. That is the whole uninstall: it writes nothing outside
itself, and the only thing it ever stores is your browser's own cache and saved
work, which live in the browser.
