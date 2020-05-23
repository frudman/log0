## Minimal Server-side Dev Logger

- Like linux tail but for multiple files at once inclusing non-existing ones yet

- SHOULD INSTALL this package as GLOBAL (-g) in order to use its viewer directly (i.e. `prompt:> log0 ...`)
- else, can use `prompt:> npx log0 ...`


logging means different things to different people: for production apps, logging is meant
    to record events as they happen for later analysis (esp large apps with cloud-based logging)
    for bug extraction and performance improvement or feature enhancement.

    For developers, the stage matters: beta, production, alpha, or early (pre-alpha)

    Often, early on, "logging" is really shortform debuggin (not involving an actual debugger)

    It doesn't replace a debugger, it's just another too in the toolbelt.

    In these cases, logging is not so much to "log an event" but to "dump a value" as app
    is running to see what's going on (esp when a denugger is not available or practical or worth
        that particular effort)
        
    Just plain 'console.log' this stuff and see if it looks right.

    For these times, different parts of the app may be generating different amount of information
    and you may want separate windows (i.e. terminals) to see each in realtime

    In particular, when you do fancy window-like handling of main stdout, may want other windows
    to dump "running commentary" (reality checks) of debugging statements