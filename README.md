# log0 (as in "log zero")

- [Purpose](#motivation)
- [Usage](#usage)
- [JUST SHOW ME!](#showme)

<a name=showme></a>
## TL;DR

**0) Install** globally for easier viewer access:

`npm install -g log0` 

**1) Write** to your logs from any **node.js** app: 
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

**2) View** live logs **simultaneously** in different terminal windows:
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

[Full usage instructions below](#usage)

<a name=motivation></a>
## Motivation

log0 addresses the primary limitation of debugging with `console.log`, namely that everything goes to a single stream, **stdout**.

Instead, use `log.yourLogNameHere('hello there!')` in your node.js app, so that you can then, *from any other [multiple] terminal window(s)*, **view that on-the-fly live stream** by simply typing `log0 yourLogNameHere` at the command line (equivalent to `log0 your-log-name-here`).

Your node.js app can always access the main (primary) terminal console (stdout) by using the unadorned `log()` function.

You can create any number of **"virtual logs" (a.k.a. streams)** just by accessing them as *dynamic* properties 
of the "root" log, such as `log.aVirtualLogNameHere()`.

You can create "sub-logs" by simply nesting further, such as `log.virtual1.subVirtual2.subSubVirtual3.sub4()`.

You can use a [**shorthand**](#Shorthand) notation within any node.js app file for legibility. For example:
```
// long way...
log.virtual1.subVirtual2.subSubVirtual3.sub4('some information here');

// a better way...
const logx = log.virtual1.subVirtual2.subSubVirtual3.sub4;

// then...
logx('some information here');
```

## What log0 Is NOT (...not to be...)

It's **not** a long term archival logger such as [Winston](https://www.npmjs.com/package/winston) or [Banyan](https://www.npmjs.com/package/bunyan), or for [Cloud Logging](https://cloud.google.com/logging/docs/setup/nodejs).

It's **not** a way to [log into something](https://english.stackexchange.com/questions/5302/log-in-to-or-log-into-or-login-to).

It's **not** a browser-based utility.

It's **not** a [Captain's Log, Stardate 2020](https://memory-alpha.fandom.com/wiki/Category:Captain%27s_logs).

It's **not** a [log cabin](https://en.wikipedia.org/wiki/Log_cabin)

It's **not** [syrup](https://www.logcabinsyrups.com/)

## What log0 Is (...to be...)

log0's purpose is for **LIVE**, **IMMEDIATE**, while-you-are-developing, **LOCAL**, *console.log*-like logging for **server-side node.js development**.

And that's where it derives its name:
- Its logs are *ephemeral*. It logs **0 (zero)** entries permanently
- It's very simple, slim, and feature-lite, hence **0 as in zero-weight** on your app (double-entendre, anyone?)

## Short Story Long

Logging means different things to different parties: for production apps & managers, logging is long-term
and meant to record events as they happen for later analysis (especially large apps with cloud-based logging)
for bug extraction and performance improvement or feature enhancement.

For developers, the stage of development (beta, production, alpha, or early-pre-alpha) affects the type 
and purpose of logging. Often, very early on, logging is really just **quick-n-dirty debugging** (not involving 
an actual debugger). It doesn't replace a debugger, but rather it's just another tool in our developer's toolbelt.

In these cases, logging is not about "logging an event" but rather it's to "dump a value" as an app
is running to see what's going on (especially when an actual debugger is not available or practical or worth
that particular effort).

Basically, just plain 'console.log' something and see if it 'looks right.'

For these times, different parts of the app may be generating different volumes of information
and you may want separate windows (i.e. terminals) to see each in realtime.

In particular, when you do fancy window-like handling of main stdout, you may want to use other windows
to view a "running commentary" (reality checks) of debugging events (i.e. log.x() statements) within your app.

<a name=usage></a>
## Usage

Once [log0 is installed](#installation), it's used in 2 parts:
1. Developer launches an app which then [logs information as it's executing](#logging-entries)
2. Developer can then simultaneously [view those logs from separate window(s)](#viewing-logs)

### Installation

`npm install -g log0` 

By installing globally, you can always, from any terminal window, access the viewer by simply
using the `log0` command. For example: `log0 builder ...error`

If not installed globally, can always use it, in a given project, as: `npx log0 ...error`

ps: you SHOULD INSTALL this package as GLOBAL (-g).


<a name=logging-entries></a>
### Logging Entries

use by any means, as follows:
- `const log = require('log0');`
- `const {log,lo0} = require('log0');` [both are the same, for convenience]

Can create on-the-fly logs as follows:
- `const {normalStuff, error, warning, neverMind, fancyBee} = log;`
    - creates virtual log functions, that can be used as:
        ```
        normalStuff('log message here');
        error('log message here');
        warning('log message here');
        neverMind('log message here');
        fancyBee('log message here');
        ```


#### Dynamic Streams (or "virtual logs")

A stream is dynamically created by simply accessing it as a property on the root `log()` function.

So, to create a stream named abcxyz, just write to it using `log.abcxyz(...your stuff here...)`.

// log(...)     to log to .log0/logs/log0/stdout
// log.xyz(...) to log to .log0/logs/log0/xyz
// log.setApp('abc').log(...) to log to .log0/logs/abc/xyz
// log.setApp('abc').xyz(...) to log to .log0/logs/abc/xyz



### Reserved Stream Names (invlaid stream names)

// reserved log props: cannot be used as stream names
//    log | if | set
// - but ok to use variants (e.g. IF or Log): stream/filenames will still be lowercase

Also should be valid file names since used mostly as is for that

### Stream Name Mangling

It's minimal and used to treat camelNotation as camel-notation for the files
then dash-notation back to camelNotation for stream names within the app.

### Stream Details

For any given log stream, you can retrieve information for it (not sure that purpose other than to view
the actual filename of that log)

// can extract log's details (e.g. filename) by calling .set() [without any parms]
// - e.g. const { name, filename } = log.set();


#### Shorthand

#### Conditional Logging
// 2 ways to control log entries: [move this to readme.md]
// - setEnabled (or .if()): entries displayed or not

#### Custom Formatting
// - setFormatter: takes args or computed string and returns string or nothing
//      - also acts as a filter (i.e. return undefined to NOT log an entry)


#### Redirect Console.Log

#### Root Log Output
// DEFAULT LOG is done to main console
// ALL OTHER LOGGING (i.e. new streams) done to files: is that correct???

log() or log0() goto console always
ALL OTHER go to streams: log.xyz()

in other words:
log(...) ALWAYS goes to main/primary console
log.abc(...) NEVER goes to main/primary console: need log0 viewer (on another terminal window) to view it


#### App-specific Logging

If no appID, use log0

If setApp, do early on
can only do this ONCE per runtime per app



#### Recycling
// ALL log files recycled (deleted/restarted) after certain size (else would grow to LARGE SIZES quickly)


#### Sync or Async Mode

// todo: DOCUMENT how/when to specify if log/stream is SYNC or not: matters for fast logging 
//       - when order of entries matters (else some later entries may end up ahead of earlier ones)
//       - sync also ensures that all logging is complete before app end (e.g. if process.exit 
//         called somewhere else; without sync, could leave some log entries unwritten)
//       CURRENT DEFAULT IS SYNC

#### File Settings


### View Logs

The `log0` viewer is like linux `tail` command but for multiple files at once including non-existing ones yet (e.g. where there may
not have been an entry into the error stream, say);)


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

<a name=viewinf-logs></a>
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

log0's "magic" is in using plain text files in the background which can then be viewed by other concurrent processes. These files are usually deleted before or after after each use to prevent unbound storage issues (though you have [control over this](#File-Settings), including size of the files before, or if, deleted)

- All logs for ALL apps are kept under the user's home directory `~/.log0` (for example `/Users/Frederic/.log0`)
- The default log (i.e. for *unnamed apps*) is `log0` and so is kept as `~/.log0/log0`;
- All other app logs are kept based on their app name: 
    - e.g. if your app used `log.set({app: 'apple-pie'});`, its logs will be kept under `~/.log0/apple-pie`

Stream files (i.e. the actual log files) are then kept as single files under each app's applicable
log0 directory, as per above.

## TODOs

The following **very low priority** items *may* be considered for future implementation. 

Since the idea is to keep log0 **slim & very lightweight**, the implementation of items below will be based 
on user demand (if any and only if significant: so, let me know!).

### Improve this documentation

Like it says... 😀

### "Tee" Log Entries

A feature to allow a stream (e.g. log.streamX()) to be written out to simulataneous files, or to be sent
to multiple destinations. A little like the `tee` feature in Linux.

This could include other files, or event being emitted, or a more permanent syslog, or even back to main console again.

**possible implementation:** `log.streamx.set({duplicate: {...parms here...}});`

### Streaming Mode

A feature to allow a specific log/stream (e.g. log.streamX()) to be kept open 
using (for example) `fs.createWriteStream(filename, { flags: 'a', encoding: 'utf8' })`
instead of being one-off appended on every call, as done currently (`fs.appendFile(filename, logEntry)`).

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
