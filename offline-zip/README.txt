BiteSizedUtilities — the whole site, offline
============================================

{{FILES}} files, {{EXTRACTED}} extracted. Built {{BUILT}} from {{SOURCE}}.

Open START-HERE.html in a browser. It works whether or not the folder is being
served, and it says which of the two you are in.


WHY THE FOLDER DOES NOT JUST WORK
---------------------------------
A browser refuses three things when they come off the disk over file://

  1. an ES module          — which is how the kitchen loads
  2. a worker              — which is how the code runtimes execute anything
  3. a page opening a page — which is how each of the 51 games is shown

None of that is a broken download. It is what a browser allows from a folder.
Serve the folder over http://localhost and all three refusals stop applying.


ONE COMMAND
-----------
  Windows    double-click  start-server.bat
  macOS      double-click  start-server.command
  Linux      run           sh start-server.sh

Each needs Python 3, which macOS and most Linux installs already have and
Windows gets from python.org. Each serves this folder to your own machine only,
on port 8123, and stops when you close its window. Then open

  http://localhost:8123/index.html

By hand, the same thing is

  cd path/to/this/folder
  python3 -m http.server 8123 --bind 127.0.0.1


WHAT IS IN HERE
---------------
  115 utilities     maths, writing, art, music, video, code
  51 games          each its own page, which is why they need a server twice over
  CodeHub runtimes  Python, JavaScript, Bash, Luau, Befunge
  Waffle AI         {{WEIGHTS}}
  the site itself   every script, style, font, icon and runtime binary it serves

Once it is running over http, nothing is fetched from the internet: the model
weights are in this folder.


TWO HONEST CAVEATS
------------------
Threaded WASM will run one thread deep. Shared-memory threads need cross-origin
isolation headers, which python's http.server cannot send. The site detects that
and drops to a single thread, so the runtimes and Waffle AI still work — some of
them just take longer.

A phone or tablet cannot do the serving. There is no local server on a tablet
without a third-party app, so this folder is for a computer. That is a limit of
the device, not of the zip.


IF YOU DID NOT MEAN TO KEEP IT
------------------------------
Delete the folder. It writes nothing outside itself, and the only thing it ever
stores is your browser's own cache and saved work, which live in the browser.
