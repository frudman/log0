## TL;DR

**Install** globally for easier viewer access:

`npm install -g log0` 

**Write** to your logs from any **node.js** app: 
```
const log = require('log0'); // obviously
let abc=123, xyz="string", obj={abc,xyz}; // testing

// then...
log('hello there!', obj, abc);

// fancy...
log.myStream1(abc, 'some other information', xyz);
log.someOtherLog('yet more info still', xyz, abc);
log.runtime(obj, 'fancy stuff here', xyz, abc);
log.myStream1.subStream(xyz, obj, 'more information here', abc);
log.runtime.error(`whoops, you've done it again!`, xyz);
log.runtime.warning(`i forgive you this time!`, xyz);
log.parsing('parse phase info', obj);
log.parsing.error('sorry, no can do', xyz);
log.parsing.warning(`it's ok, i'll just keep going`, xyz);
log.streamingLilies('what is that???');

// neato...
const perr = log.parsing.error;
perr('sorry, no can do', xyz);
```

**View** live logs *simultaneously* in different terminal windows:
- in app's (main, primary) terminal window: 
    - `log(...)` entries always go to **stdout** (same as console.log)
- in window #2: `log0 my-stream1`
    - `log.myStream1(...)` entries show up here
- in window #3: `log0 myStream1.subStream`
    - `log.myStream1.subStream(...)` entries show up here
- in window #4: `log0 my-stream1.sub-stream`
    - same as previous one
- in window #5: `log0 some-other-log`
    - `log.someOtherLog(...)` entries show up here
- in window #6: `log0 ...error`
    - **wildcards**: entries from any log with name ending with `error` show up here
    - this includes `log.runtime.error` and `log.parsing.error` from above
- in window #7: `log0 parsing...`
    - **wildcards**: entries from any log with name starting with `parsing` show up here
    - this includes `log.parsing` and `log.parsing.error` from above
- in window #8: `log0 ...stream...`
    - **wildcards**: entries from any log whose name contains `stream` show up here
    - this includes `log.myStream1`, `log.myStream1.subStream`, and `log.streamingLilies` from above
- in window #9: `log0 ...warning... ...error`
    - **wildcards**: entries from any log whose name contains `warning` or `error` show up here
    - this includes `log.runtime.error`, `log.runtime.warning`, `log.parsing.error`, and `log.parsing.warning` from above
- and so on...

[Full usage instructions below](#Usage)

## Motivation

LOG0 addresses the primary limitation of `console.log` debugging, namely that everything goes to a single stream, namely **stdout**.
By simply using `log.yourStreamNameHere('hello there!')` in your node.js app, you can then, from any other terminal window view that on-the-fly live stream
by typing `log0 yourStreamNameHere` at the command line (or `log0 your-stream-name-here`).

You can always access the main (primary) app's terminal console (stdout) by using the unadorned `log()` function.

You can create any number of "virtual logs" (a.k.a. streams) just by accessing them as a property of the "root" log, such as `log.virtualLogNameHere()`.

You can create sub-logs by simply nesting further, such as `log.virtual1.subVirtual2.subVirtual3.sub4()`.

You can use shorthand notation within any file for legibility. For example:
```
log.virtual1.subVirtual2.subVirtual3.sub4('some information here');

// a better way:
const logx = log.virtual1.subVirtual2.subVirtual3.sub4;

// then:
logx('some information here');
```

## What LOG0 Is NOT! (...not to be...)

It's **not** a long term archival logger like typical loggers such as [Winston](https://www.npmjs.com/package/winston) or [Banyan](https://www.npmjs.com/package/bunyan), or for [cloud logging](https://cloud.google.com/logging/docs/setup/nodejs).

It's **not** a [Captain's Log, Stardate 2020](https://memory-alpha.fandom.com/wiki/Category:Captain%27s_logs).

It's **not** a [log cabin](https://en.wikipedia.org/wiki/Log_cabin)

It's **not** a way to [log into something](https://english.stackexchange.com/questions/5302/log-in-to-or-log-into-or-login-to).

## What LOG0 Is! (...to be...)

LOG0's purpose is for **LIVE**, **IMMEDIATE** while-you-are-developing, console.log-type loging (logging?).

That's where the name comes from. It's logs are *ephemeral*. It logs **0 (zero)** entries permanently.

It's also very simple and feature-lite, hence LOG0 again (in a sort of a double-entendre).

## Implementation Notes

It's "magic" is in using plain text files in the background which can then be viewed by others. These files are deleted after each use to prevent unbound storage problems (though you have control over this, including size of file before or if deleted)

## Installation


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


## Usage

### Log Usage (how to log)


### Viewer Usage (how to view live logs)

`cmd> log0 ...`

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