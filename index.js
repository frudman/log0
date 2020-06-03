"use strict"; // keep until es-moduled

/* see README.md for usage */

// todo: MUST MUST ALLOW to specify if log/stream is SYNC or not: matters for fast logging 
//       - when order of entries matters (else some later entries may end up ahead of earlier ones)
//       - sync also ensures that all logging is complete before app end (e.g. if process.exit 
//         called somewhere else; without sync, could leave some log entries unwritten)

// todo: setDuplicateRedirect: redirect to somewhere else - multiple destinations 
//       - e.g. other file(s) for more permanence; syslog; ...

// todo: setStreaming mode: keeps file open for faster (maybe async?) writes
//       - e.g. strm = fs.createWriteStream(filename, { flags: 'a', encoding: 'utf8' })
//              [then] process.on('exit', () => strm.close())

// todo: write file in "circular mode" where file rewrites itself from start
//       - controls max file size easily
//       - how to indicate (e.g. to self, to viewer) where end and beginning is

const fs = require('fs'),
      {dirname} = require('path');

// shorthand until https://github.com/tc39/proposal-throw-expressions
const throwe = err => { throw (typeof err === 'string') ? new Error(err) : err; }

// below as per: // https://nodejs.org/api/errors.html#errors_common_system_errors
const FileNotFound = ex => ex.errno === 2 || /ENOENT/i.test(ex.code || ''); 

const LOG0_APP_DIR = '.log0'; // e.g. `~/.log0/app-name` for mac & linux
const userDir = require('os').homedir();
const getLogDir = appID => `${userDir}/${LOG0_APP_DIR}/${appID.toLowerCase()}`;

// note: root is a dir (below): no file for "root log" (i.e. log(...)) because its output 
// always goes to console (this is so app can always explicitly target its main console)
const genLogFileFullName = (appID, streamName, lvl, parent) => 
    lvl === 0 ? getLogDir(appID) // root dir for streams 
              : (parent[streamFileNameProp] + (lvl === 1 ? '/' : '.') + streamName.toLowerCase());

// based on: https://stackoverflow.com/a/28397970/11256689
// - https://nodejs.org/api/util.html#util_util_inspect_object_options
// - as per this one, only need an 'inpect()' method: https://stackoverflow.com/a/28397970/11256689
const util = require('util'),
      consoleString = util.inspect.custom; // for help while debugging

// colors as per: https://en.wikipedia.org/wiki/ANSI_escape_code#Colors
// also read: https://stackoverflow.com/a/41407246
// fyi: https://blog.bitsrc.io/coloring-your-terminal-using-nodejs-eb647d4af2a2
const esc = `\x1b`, red = 31, brightRedx = 91, brightRed = `1;31`, black = 40, reset = 0,
      colorize = (clr,txt) => txt ? `${esc}[${clr}m${txt}${esc}[${reset}m` : `${esc}[${clr}m`,
      redish = txt => colorize(brightRed, txt);

// from: https://stackoverflow.com/a/30360821
const setWindowTitle = title => process.stdout.write(`${esc}]0;${title}\x07`);

// todo: move to core.js; add means to customize (e.g. remove throwe, log0/index.js, ...)
function extractStack(err) {
    // based on (and should be improved using): https://v8.dev/docs/stack-trace-api
    // basically: we remove cruft (e.g. node & log0 & other stuff)
    // trivial implementation (todo: maybe use Error.prepareStackTrace instead?)
    return (err || new Error()).stack.split(/^\s*at\s+/m)
        .filter(l => !(/^Error|^internal[/]|^throwe|[(]internal[/]|log0[/]index[.]js/.test(l)))
        .join('\t').trim();
}

// used for util.inspect options
const defaultUtilInspectOpts = {depth: 2, colors: true};
function toDebugString(inspectOpts, ...args) { 

    // similar to what's displayed by console.log(...args)
    // based on: https://nodejs.org/api/util.html#util_util_inspect_object_options

    // todo: difference between util.inspect and util.format?
    // - https://nodejs.org/api/util.html#util_util_format_format_args

    // note: for all console.X methods: first arg is string with %ref to following args
    // - if fewer %refs than args, extra args simply appended as formatted strings
    
    // todo: COLORIZE undefined/null/empty-string?

    // why not simply let util.inspect deal directly with each arg?
    return args.map(a => 
        a === undefined ? '--undefined--' 
      : a === null ? '--null--'
      : a === '' ? "''"
      : a instanceof Error ? redish(`ERROR: ${a.message}\n${extractStack(a,false)}`)
      : /object|function/.test(typeof a) ? util.inspect(a, inspectOpts || defaultUtilInspectOpts) 
      : a.toString()).join(' '); // symbols, primitives
}

function toUnicode(str) {
    return (str || '').split('')
        .map(c => c.charCodeAt().toString(16).toUpperCase().padStart(4, '0'))
        .reduce((unicode,c) => unicode += `\\u${c}`, '');
}

function getter(obj, prop, getter) {
    Object.defineProperty(obj, prop, { 
        enumerable: false,
        configurable: false,
        get: getter
    })
}

// base console might be changed (i.e. if taken over) so keep original safe
const CONSOLE_LOG = console.log.bind(console);
let CONSOLE_OVERRIDE = false; // only 1 console so singleton for all loggers

process.on('exit', (...args) => {
    // called NO MATTER WHAT (even if unhandled exceptions/rejections)
    // good place to close open streams (if any)
    // - so, when opening a stream, set process.on(exit) to close it
    CONSOLE_LOG('app exiting', args);
})

// see: https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
// process.on('uncaughtException', (...args) => {
//     CONSOLE_LOG('app exiting: UNCAUGHT EXCEPTION', args);
// })
// process.on('unhandledRejection', (...args) => {
//     // yep, it's a thing!
//     CONSOLE_LOG('app exiting: UNHANDLED REJECTION', args);    
// })

// can only set it once per app & can't change it after (reason below)
const defaultAppID = 'log0';
let singletonAppID = defaultAppID, listeners = [];
const onAppIDChanged = action => { action(singletonAppID); listeners.push(action); }
function setAppID(appID) {
    if (singletonAppID === defaultAppID) {
        singletonAppID = appID;
        listeners.forEach(listener => listener(appID));
    }
    else if (appID !== singletonAppID) {
        // only allow appID to be set once (by presumably controlling app) else other
        // 3rd party modules could change it midstream
        throw new Error(`App ID already set to /${singletonAppID} (cannot be changed to /${appID})`)
    }
}

// use symbols to keep some props internal
const streamNameProp = Symbol('stream name');
const streamFileNameProp = Symbol('stream filename');
const aliasesProp = Symbol('for stream aliases');

function createLogger({name, parent, lvl = 0} = {}) {

    // reserved log props: cannot be used as stream names
    //    log | if | set
    // - but ok to use variants (e.g. IF or Log): stream/filenames will still be lowercase

    // can extract log's details (e.g. filename) by calling .set without any parms
    // - e.g. const { name, filename } = log.set();

    // 2 ways to control log entries: [move this to readme.md]
    // - setEnabled (or .if()): entries displayed or not
    // - setFormatter: takes args or computed string and returns string or nothing
    //      - also acts as a filter (i.e. return undefined to NOT log an entry)

    const streams = {}; // substreams of this logger
    const aliases = {}; // aliased for substreams (e.g. warn same as warning)

    // all stream & alias names are normalized (spaces and camelNotation to dashes)
    const normalize = name => name.replace(/\s+/g,'-').replace(/[a-z][A-Z]/g, m => `${m[0]}-${m[1].toLowerCase()}`);

    //let useSyncMethod = true; // note: todo: alternative NOT implemented
    let consoleOptions = defaultUtilInspectOpts;
    let tracing = false;

    // how a log entry is generated
    const defaultFormatter = (...args) => toDebugString(consoleOptions || defaultUtilInspectOpts, ...args);

    // is log stream live/enabled [changed via iffer() function (below)]
    let enabled = true; // can be true, false, or a function

    // set via setFormatter
    let formatter = defaultFormatter;

    const loggerName = () => lvl === 0 ? singletonAppID : parent[streamNameProp] + '.' + name;

    let filename, wrEntry; // initialized right below...
    onAppIDChanged(newAppID => {
        filename = genLogFileFullName(newAppID, name, lvl, parent);
        wrEntry = setFileOptions();
    });

    function actualLogger(...args) {
        const shouldLog = enabled === true || (enabled === false ? false : enabled(...args));
        if (shouldLog) {
            if (lvl > 0) { // formatting & filtering here
                const logEntry = tracing ? formatter(...args, '\n...', extractStack()) : formatter(...args);
                (logEntry === undefined) || wrEntry(logEntry);
            }
            else { // root log ALWAYS writes to app's main/primary console
                CONSOLE_LOG("***", ...args);
            }
        }
        return loggerProxy; // important
    }

    const setters = {
        setApp, // most important
        setFormatter, // also a filter (when returns undefined log entry not logged)
        setEnabled, // short for .if()
        setAlias, // e.g. warn=warning; (means warn is same as warning, and/but warning is to be used)

        setColorInFiles(flag = true) { consoleOptions.colors = flag; },
        setConsoleOptions(options) { consoleOptions = options || defaultUtilInspectOpts; },
        setSync(flag = true) { useSyncMethod = flag },
        setTracing(flag = false) { tracing = flag; }, // log entry add where it was logged from

        setFileOptions,
        setConsoleRedirect,
    }

    function setx(...opts) {
        if (opts.length === 0) // no args to get back current settings
            return { name, fullname: loggerName(), filename, appID: singletonAppID, //useSyncMethod, 
                consoleOptions, tracing, formatter, streams, aliases };

        for (const optx of opts)
            for (const [k,v] of Object.entries(optx)) {
                const setter = 'set' + k[0].toUpperCase() + k.substring(1);
                (setter in setters) && setters[setter](v);
            }

        return loggerProxy;
    }

    function setApp(appIDorFileName) {

        const appID = (appIDorFileName + '')// may be a filename so extract from it
            .replace(/[/]index[.]js$/,'') // remove trailing /index.js (if any)
            .replace(/[.]js$/,'') // remove trailing .js
            .replace(/.*?[/]([^/]+)$/, '$1') // keep last part of the path (i.e. /no/no/no/no/yes)
            .replace(/\s+/g, '-') // remove blank spaces
            .replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase()); // camel to dash

        setAppID(appID);
    }

    function setFormatter(formatterFcn) {

        // function to set; anything else (incl nothing) to reset to default
        // if function, return:
        // - string to log as is (includes an empty string)
        // - undefined to NOT log (so filtered out)
        // - array normally (but uses array items instead of original args)
        //      - useful when want to add, change, or remove args
        // - anything else will use default formatter on that single arg

        // function can take:
        // - (...originalArgs) to use as needed
        // - (argsAsStr, ...originalArgs) where argsAsStr is the default-formatted
        //   string to use as needed; originalArgs also passed to formatter

        if (typeof formatterFcn === 'function') {
            formatter = (...args) => {
                const fmtd = (formatterFcn.length === 0) ? formatterFcn(...args)
                    : formatterFcn(defaultFormatter(...args), ...args);

                return Array.isArray(fmtd) ? defaultFormatter(...fmtd)
                    : (fmtd === undefined || typeof fmtd === 'string') ? fmtd
                    : defaultFormatter(fmtd);
            }
        }
        else
            formatter = defaultFormatter; // reset back to default
    }

    function setEnabled(cond) {
        enabled = (typeof cond === 'function' && cond.length === 1) ?
            ((...args) => cond(defaultFormatter(...args), ...args)) : cond;
    }

    function iffer() {

        // todo: should we also disable substreams? how to specify?
        //       or should that be the default?

        // returns a function always
        // - that function ALSO always returns loggerProxy
        // - that function ALSO has attached 2 read-only props: .enabled and .disabled

        function ifx(cond, ...args) {
            if (args.length === 0) { // setting for that stream
                setEnabled(cond); // .if as shorthand for set({enabled:cond});
            }
            else { // setting just for this once
                let enabled = (typeof cond === 'function') ?
                    (cond.length === 1) ? cond(defaultFormatter(...args), ...args) : cond(...args) : cond;
                enabled && actualLogger(...args);
            }

            return loggerProxy;
        }

        // "read-only" props (getters)
        getter(ifx, "enabled", () => enabled); // filtered (function, so truish) or not explicitly disabled
        getter(ifx, "disabled", () => enabled === false); // not filtered and not explicitly enabled

        return ifx;
    }

    function setAlias(aliases) {
        aliases.split(/[,;:|\s]+/).filter(x=>x)
            .forEach(alias => parent[aliasesProp][alias] = loggerProxy);
    }

    function setConsoleRedirect(streamName) {

        // Redirect console.(log|error|warn|warning|info|debug) methods
        // - but can only be called once, after which...
        //   ...ALL console.log calls from any module (incl. 3rd party) will be redirected

        if (CONSOLE_OVERRIDE)
            return CONSOLE_LOG('SORRY, already overriden!'); // prevents others from changing
        
        if (streamName === true || typeof streamName === 'string') {

            // can't actually replace 'console' but take over each [important] function
            // also, console.X methods do NOT return anything so must adhere to that

            CONSOLE_OVERRIDE = true;

            let proxy = loggerProxy; // use me as substream (implicit, default), or...
            if (typeof streamName === 'string') { // ...use a separate substream for it (explicit)
                streamName.trim().split(/[.]+/).map(normalize).forEach(substream => proxy = proxy[substream]);
            }

            console.log = (...args) => { proxy(...args); };
            'error info warning debug'.split(/\s+/).forEach(s => console[s] = proxy[s]);
            console.warn = proxy.warning; // alias
        }            
        else if (!streamName) {
            // todo: if === null, should this mean to disable output?
            // to disable output for console.X use console.x.if(false);
            CONSOLE_LOG(`SORRY, can't release console (not impl)`);
        }
    }

    function setFileOptions({maxInMB=10, slices=4, deleteOnStart=true, useSync=true} = {}) {

        // TODO: VERY WEAK SOLUTION; need something more robust
        // todo: split MAX_SIZE into multiple files then rotate those so always have a "tail"
        //       of prior log entries (as newly rotated file starts from 0 length)

        let info;
        let MAX_LOG_SIZE = maxInMB * 1024 * 1024; // to bytes

        return (arguments.length === 0) ? wrLog : (wrEntry = wrLog);

        function delFile() {
            try {
                fs.unlinkSync(filename); // do NOT simply overwrite else viewer won't detect
            }
            catch(ex) {}
            return { filename, size: 0 };
        }

        function recycle(newAmount) {
            if (!info || info.filename !== filename) {                
                fs.mkdirSync(dirname(filename), { recursive: true });
                if (deleteOnStart) {
                    info = delFile();
                }
                else {
                    try {
                        info = { filename, size: fs.statSync(filename).size }
                    }
                    catch(ex) { // for now, just assume file not created yet
                        info = { filename, size: 0 }
                    }    
                }
            }
            info.size += newAmount;
            if (info.size > MAX_LOG_SIZE) {
                info = delFile();
            }
        }

        function wrLog(entry) {
            recycle(entry.length + 1);
            if (useSync)
                fs.appendFileSync(filename, '\n' + entry);
            else
                fs.appendFile(filename, '\n' + entry, err => {
                    err && CONSOLE_LOG('error writing to log', filename, entry, err);
                });
        }
    }

    // note: proxy target MUST be a function so proxy's apply method (below) is called
    //       - only the type matters, namely that it's a function
    //       - the actual function itself is immaterial so anonymous will do (i.e. ()=>{})
    //       - since it's otherwise unused by us (i.e. what becomes the target in methods below),
    //         we use it to keep track of the user's custom props (if any)
    const loggerProxy = new Proxy(()=>{}, {
        get(target, prop) {
            if (prop === 'log') return loggerProxy;
            if (prop === 'if') return iffer(); // shorthand for setEnabled
            if (prop === 'set') return setx;
            if (prop === streamNameProp) return loggerName(); // private prop (using symbol)
            if (prop === streamFileNameProp) return filename; // private prop (using symbol)
            if (prop === aliasesProp) return aliases; // private prop (using symbol)

            // give user-defined props priority over streams
            if (prop in target) return target[prop]; // use otherwise-unused target for storage

            if (prop in streams) return streams[prop]; // a proxied function
            if (prop in aliases) return aliases[prop]; // alias for existing stream

            if (typeof prop !== 'string') return undefined; // e.g. symbol

            // create new stream
            const name = normalize(prop);
            return streams[name] = createLogger({ name, parent: loggerProxy, lvl: lvl+1 });
        },
        apply(target, thisArgs, args) {
            return actualLogger(...args);
        },
        set(target, prop, value) {
            target[prop] = value; // use otherwise-unused target for storage
            return true; // important (assignement success) else node error
        },
        deleteProperty(target, prop) {
            // todo: maybe allow STREAMS to be deleted? any purpose fo it?
            //       maybe to close a log? security risk?
            (prop in target) && delete target[prop];
            return true; // for now: delete works always
        },
    });

    return loggerProxy;
}

const log0 = createLogger(); // create the 'root' logger

module.exports = {
    log0,
    log: log0, // alias for convenience

    consoleString,
    throwe,

    // used by viewer
    getLogDir,
    FileNotFound,

    // useful tidbits for stdout
    colorize,
    redish,
    setWindowTitle,

    // more useful tidbits
    toDebugString,
    toUnicode,
}