# log0 (as in "log zero")

## TL;DR

**Install** globally for easier viewer access:

`npm install -g log0` 

**Write** to your logs from any **node.js** app: 
```
const log = require('log0'); // obviously
let abc=123, xyz="string", obj={abc,xyz}; // testing

// then...
log('hello there!', abc, xyz, obj);

// fancy...
log.myStream1(abc, 'some other information', xyz);
log.someOtherLog('more info still', xyz, abc);
log.runtime(obj, 'fancy stuff here', xyz, abc);
log.myStream1.subStream(xyz, obj, 'yet more information here', abc);
log.runtime.error(`whoops, you've done it again!`, xyz);
log.runtime.warning(`i forgive you this time!`, xyz);
log.parsing('parse phase #42 info', obj);
log.parsing.error('sorry, no can do', xyz);
log.parsing.warning(`it's ok, i'll just keep going`, xyz);
log.topical.screamingLilies('what is that???');

// neato...
const perr = log.parsing.error;
perr('sorry, no can do', xyz);
```

**View** live logs **simultaneously** in different terminal windows:
- in app's (main, primary) terminal window: 
    - `log(...)` entries always go to **stdout** (same as console.log)
- in window #2: `log0 my-stream1`
    - `log.myStream1(...)` entries show up here
- in window #3: `log0 myStream1.subStream`
    - `log.myStream1.subStream(...)` entries show up here
- in window #4: `log0 my-stream1.sub-stream`
    - same as window #3
- in window #5: `log0 some-other-log`
    - `log.someOtherLog(...)` entries show up here
- in window #6: `log0 ...error`
    - **wildcards**: entries from any log with name ending with `error` show up here
    - this includes `log.runtime.error` and `log.parsing.error` from above
- in window #7: `log0 parsing...`
    - **wildcards**: entries from any log with name starting with `parsing` show up here
    - this includes `log.parsing` and `log.parsing.error` from above
- in window #8: `log0 ...s...ream...`
    - **wildcards**: entries from any log whose name contains `s` and `ream` show up here
    - this includes `log.myStream1`, `log.myStream1.subStream`, and `log.topical.screamingLilies` from above
- in window #9: `log0 ...warning... ...error...`
    - **wildcards**: entries from any log whose name contains `warning` or `error` show up here
    - this includes `log.runtime.error`, `log.runtime.warning`, `log.parsing.error`, and `log.parsing.warning` from above
- and so on...

[Full usage instructions below](#Usage)

## Motivation

log0 addresses the primary limitation of `console.log` debugging, namely that everything goes to a single stream, **stdout**.

Use `log.yourStreamNameHere('hello there!')` in your node.js app, so that you can then, *from any other terminal window* **view that on-the-fly live stream**
by typing `log0 yourStreamNameHere` at the command line (equivalent to `log0 your-stream-name-here`).

Your app can always access the main (primary) terminal console (stdout) by using the unadorned `log()` function.

You can create any number of **"virtual logs" (a.k.a. streams)** just by accessing them as a property of the "root" log, such as `log.virtualLogNameHere()`.

You can create sub-logs by simply nesting further, such as `log.virtual1.subVirtual2.subSubVirtual3.sub4()`.

You can use [**shorthand**](#Shorthand) notation within any .js file for legibility. For example:
```
// one way...
log.virtual1.subVirtual2.subSubVirtual3.sub4('some information here');

// a better way...
const logx = log.virtual1.subVirtual2.subSubVirtual3.sub4;

// then...
logx('some information here');
```

## What log0 Is NOT (...not to be...)

It's **not** a long term archival logger such as [Winston](https://www.npmjs.com/package/winston) or [Banyan](https://www.npmjs.com/package/bunyan), or for [Cloud Logging](https://cloud.google.com/logging/docs/setup/nodejs).

It's **not** a way to [log into something](https://english.stackexchange.com/questions/5302/log-in-to-or-log-into-or-login-to).

It's **not** a [Captain's Log, Stardate 2020](https://memory-alpha.fandom.com/wiki/Category:Captain%27s_logs).

It's **not** a [log cabin](https://en.wikipedia.org/wiki/Log_cabin)

## Short Story Long

Logging means different things to different people: for production apps, logging is meant
to record events as they happen for later analysis (esp large apps with cloud-based logging)
for bug extraction and performance improvement or feature enhancement.

For developers, the stage of development (beta, production, alpha, or early-pre-alpha) affects the type 
and purpose of "log entries."

Often, early on, "logging" is really shortform debugging (not involving an actual debugger);

It doesn't replace a debugger, but rather "console.log" is just another tool in the toolbelt.

In these cases, logging is not about "logging an event" but rather it's to "dump a value" as an app
is running to see what's going on (esp when an actual debugger is not available or practical or worth
that particular effort).

Basically, just plain 'console.log' something and see if it 'looks right.'

For these times, different parts of the app may be generating different amount of information
and you may want separate windows (i.e. terminals) to see each in realtime

In particular, when you do fancy window-like handling of main stdout, you may want other windows
to dump a "running commentary" (reality checks) of debugging events (i.e. log.x() statements);

## What log0 Is (...to be...)

LOG0's purpose is for **LIVE**, **IMMEDIATE**, while-you-are-developing, **LOCAL**, console.log-type logging.

That's where the name comes from. It's logs are *ephemeral*. It logs **0 (zero)** entries permanently.

It's also very simple and feature-lite, hence log0 again (in a sort of a double-entendre).


## Installation

`npm install -g log0` 

By installing globally, you can always, from any terminal window, access the viewer by simply
using the `log0` command. For example: `log0 builder ...error`

If not installed globally, can always use it, in a given project, as: `npx log0 ...error`

- SHOULD INSTALL this package as GLOBAL (-g) in order to use its viewer directly (i.e. `prompt:> log0 ...`)
- else, can use `prompt:> npx log0 ...`

## Usage

### Log Usage (how to log)

`import {log} from 'log0';`

// reserved log props: cannot be used as stream names
//    log | if | set
// - but ok to use variants (e.g. IF or Log): stream/filenames will still be lowercase

// can extract log's details (e.g. filename) by calling .set() [without any parms]
// - e.g. const { name, filename } = log.set();

// document all setX methods

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




#### Shorthand

#### Conditional Logging
// 2 ways to control log entries: [move this to readme.md]
// - setEnabled (or .if()): entries displayed or not

#### Custom Formatting
// - setFormatter: takes args or computed string and returns string or nothing
//      - also acts as a filter (i.e. return undefined to NOT log an entry)

#### Sync or Async Mode

// todo: DOCUMENT how/when to specify if log/stream is SYNC or not: matters for fast logging 
//       - when order of entries matters (else some later entries may end up ahead of earlier ones)
//       - sync also ensures that all logging is complete before app end (e.g. if process.exit 
//         called somewhere else; without sync, could leave some log entries unwritten)
//       CURRENT DEFAULT IS SYNC

#### File Settings


### Viewer Usage (how to view live logs)

Like linux tail but for multiple files at once inclusing non-existing ones yet


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

#### Viewing Logs

// basically, from separate terminal windows:
// - `log0` [to view ALL logs (streams) for unnamed app(s)]
// - `log0 my-app` [to view ALL logs (streams) for app named 'my-app']
// - `log0 my-app error warning` [to view only the error and warning stream for app named 'my-app']
// - `log0 my-app ...error ...warning` [to view my-app streams with names ending in 'error' or 'warning']
// - `log0 my-app error... ...warning` [to view my-app streams with names starting with 'error' or ending with 'warning']
// - `log0 my-app ...abcxyz... warning.severe` [to view my-app streams with names containing 'abcxyz'; also the warning.severe stream]


#### Wildcards

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

`cmd> log0 ...`



## Implementation Notes

It's "magic" is in using plain text files in the background which can then be viewed by others. These files are deleted after each use to prevent unbound storage problems (though you have [control over this](#File-Settings), including size of the files before or if deleted)


## TODOs

The following **very low priority** items considered for future implementation. 

Since the idea is to keep log0 **very lightweight**, the implementation of items below will be based 
on user demand (if any, if significant: let me know).

### Duplicate Log Entries

a feature to allow a stream (e.g. log.streamX()) to be written out to simulataneous files, or to be sent
to multiple destinations.

This could include other files, or event being emitted, or a more permanent syslog.

**possible implementation:** `log.streamx.set({duplicate: {...parms here...}});`

### Streaming Mode

A feature to allow a specific log/stream (e.g. log.streamX()) to be kept open 
using (for example) `fs.createWriteStream(filename, { flags: 'a', encoding: 'utf8' })`
instead of being one-off appended on every call currently (`fs.appendFile(filename, logEntry)`).

This could improve performance in high-volume, low-latency cases, where a lot of log entries
are being generated in a very short amount of time (e.g. sub-milliseconds);

**possible implementation:** `log.streamx.set({streamingMode: 'keep open'});`

note: would then want to have: `process.on('exit', () => strm.close());`

### Circular File Mode

A feature to allow a file to be written in a circular fashion: when end of max-size of file
is reached, write new entries back at the front.

This would simplifiy maximum file size (no need to delete, re-create) and allow for a record
left of prior entries (i.e. a tail) which is currently lost when a log file is recycled
(i.e. deleted before new entries are written)

While it would be a nice clean solution, a challenge would be how to efficiently keep track
of current start and end of the file, and how this gets communicated to the viewers.
