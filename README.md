// TODO: Write this readme doc!
// TODO: cleanup the samples

    // document all setX methods

    // reserved log props: cannot be used as stream names
    //    log | if | set
    // - but ok to use variants (e.g. IF or Log): stream/filenames will still be lowercase

    // can extract log's details (e.g. filename) by calling .set() [without any parms]
    // - e.g. const { name, filename } = log.set();

// todo: DOCUMENT how/when to specify if log/stream is SYNC or not: matters for fast logging 
//       - when order of entries matters (else some later entries may end up ahead of earlier ones)
//       - sync also ensures that all logging is complete before app end (e.g. if process.exit 
//         called somewhere else; without sync, could leave some log entries unwritten)
//       CURRENT DEFAULT IS SYNC

// todo: setDuplicateRedirect: redirect to somewhere else - multiple destinations 
//       - e.g. other file(s) for more permanence; syslog; ...

// todo: setStreaming mode: keeps file open for faster (maybe async?) writes
//       - e.g. strm = fs.createWriteStream(filename, { flags: 'a', encoding: 'utf8' })
//              [then] process.on('exit', () => strm.close())

// todo: write file in "circular mode" where file rewrites itself from start
//       - controls max file size easily
//       - how to indicate (e.g. to self, to viewer) where end and beginning is


// basically, from separate terminal windows:
// - `log0` [to view ALL logs (streams) for unnamed app(s)]
// - `log0 my-app` [to view ALL logs (streams) for app named 'my-app']
// - `log0 my-app error warning` [to view only the error and warning stream for app named 'my-app']
// - `log0 my-app ...error ...warning` [to view my-app streams with names ending in 'error' or 'warning']
// - `log0 my-app error... ...warning` [to view my-app streams with names starting with 'error' or ending with 'warning']
// - `log0 my-app ...abcxyz... warning.severe` [to view my-app streams with names containing 'abcxyz'; also the warning.severe stream]



## Minimal Server-side Dev Logger

- Like linux tail but for multiple files at once inclusing non-existing ones yet

- SHOULD INSTALL this package as GLOBAL (-g) in order to use its viewer directly (i.e. `prompt:> log0 ...`)
- else, can use `prompt:> npx log0 ...`

## Logger Usage `import {log} from 'log0';`

If no appID, use log0
log() or log0() goto console always
ALL OTHER go to streams: log.xyz()

in other words:
log(...) ALWAYS goes to main/primary console
log.abc(...) NEVER goes to main/primary console: need log0 viewer (on another terminal window) to view it

If setApp, do early on
can only do this ONCE per runtime per app

// log(...)     to log to .log0/logs/log0/stdout
// log.xyz(...) to log to .log0/logs/log0/xyz
// log.setApp('abc').log(...) to log to .log0/logs/abc/xyz
// log.setApp('abc').xyz(...) to log to .log0/logs/abc/xyz

// DEFAULT LOG is done to main console
// ALL OTHER LOGGING (i.e. new streams) done to files: is that correct???

// ALL log files recycled (deleted/restarted) after certain size (else would grow to LARGE SIZES quickly)

// OPTION to ALSO go directly to console for 1 or more of the streams?

// DON'T FORGET (from ~/devx/log0):
// 1- increment package.json.version
// 2- make changes
// 3- push to github
// 4- npm publish
// 5- goto 1

    // 2 ways to control log entries: [move this to readme.md]
    // - setEnabled (or .if()): entries displayed or not
    // - setFormatter: takes args or computed string and returns string or nothing
    //      - also acts as a filter (i.e. return undefined to NOT log an entry)




## Viewer Usage `cmd> log0 ...`
usage: log0 [[app=]app-name] [stream directive]*
   where: live logs from 'app-name' are displayed
              - 'app=' prefix optional if 'app-name' dir exists already
              - if no app-name specified, 'log0' is used by default
          can have 0 or more [stream directive]
              - if no directives, all streams for app are displayed live
              - each stream directive has format: [+|-]stream-name[...]
                    '+' to display a stream (default so '+' optional)
                    '-' to NOT display that stream (use when displaying any other streams)
              - if any '+' directive(s), only those stream(s) are displayed
              - if only '-' directive(s), all other streams displayed
              - use ellipsis ('...') as wildcards to display streams whose names
                  contain specific words (see below)

    WILDCARDS in stream names:
    - use '...' as a wildcard [instead of the more intuitive '*' because linux shells 
      (e.g. bash, zsh) treat '*' as a shell construct and gobble it up]
    - '...' can be used as prefix, suffix, or anywhere in between:
    SO, for example, can do this:
        log0 app-name ...abcx      [view streams that end with 'abcx']
        log0 app-name abcx...      [view streams that start with 'abcx']
        log0 app-name ...xyz...    [view streams that contain 'xyz' in their name]
        log0 app-name +...xyz...   [same as above]
        log0 app-name -...xyz...   [do NOT view any stream that contains xyz in its name]


## Long Version

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