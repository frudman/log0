"use strict"; // keep until es-moduled

/* see README.md for usage */

const fs = require('fs'),
      {dirname} = require('path'),
      EventEmitter = require('events');

// shorthand until https://github.com/tc39/proposal-throw-expressions
const throwe = err => { throw (typeof err === 'string') ? new Error(err) : err; }

// below as per: // https://nodejs.org/api/errors.html#errors_common_system_errors
const FileNotFound = ex => ex.errno === 2 || /ENOENT/i.test(ex.code || ''); 

const LOG0_APP_DIR = '.log0'; // e.g. `~/.log0/app-name` for mac & linux
const userDir = require('os').homedir();
const getLogDir = appID => `${userDir}/${LOG0_APP_DIR}/${appID.toLowerCase()}`;

const isRoot = lvl => lvl === 0; // helper

// note: root is a dir (below): no file for "root log" (i.e. log(...)) because its output 
// **always** goes to console (this is so an app can always explicitly target its own console)
const genLogFileFullName = (appID, streamName, lvl, parent) => 
    isRoot(lvl) ? getLogDir(appID) // root is always a dir (not file)
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

    // note: for all console.X methods: first arg is string with '%refs' to following args
    // - if fewer %refs than args, extra args simply appended as formatted strings
    
    // todo: COLORIZE undefined/null/empty-string?

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

// helper
const getter = (obj, prop, get) => Object.defineProperty(obj, prop, { get, enumerable: false, configurable: false });

// base console can be "overwritten" so keep original safe
const CONSOLE_LOG = console.log.bind(console);
let CONSOLE_OVERRIDE = false; // only 1 console so this is a singleton for all loggers

const ibedone = new EventEmitter();
process.on('exit', exitCode => { 
    // called ALWAYS NO MATTER WHAT (even if unhandled exceptions/rejections)
    // good place to (e.g.) close open streams (if any) or delete tmp files
    ibedone.emit('done');
})

// see: https://stackoverflow.com/questions/14031763/doing-a-cleanup-action-just-before-node-js-exits
// process.on('uncaughtException', (...args) => {
//     CONSOLE_LOG('SORRY, app exiting: UNCAUGHT EXCEPTION', args);
// })
// process.on('unhandledRejection', (...args) => {
//     // yep, it's a thing!
//     CONSOLE_LOG('SORRY, app exiting: UNHANDLED REJECTION', args);    
// })

// can only set it once per app & can't change it after (reason below)
const defaultAppID = 'log0';
let singletonAppID = defaultAppID, listeners = [];
const onAppIDChanged = action => { action(singletonAppID); listeners.push(action); }
function setAppID(appID) {
    
    // only allow appID to be set once (by presumably controlling app) 
    // else other (e.g. 3rd party) modules could change it midstream

    if (singletonAppID === defaultAppID) {
        singletonAppID = appID;
        listeners.forEach(listener => listener(appID));
    }
    else if (appID !== singletonAppID) {
        throw new Error(`App ID already set to /${singletonAppID} (cannot be changed to /${appID})`)
    }
}

// use unnamed symbols to keep some props internal
const streamNameProp = Symbol();
const streamFileNameProp = Symbol();
const aliasesProp = Symbol();

function createLogger({name, parent, lvl = 0} = {}) {

    const streams = {}; // substreams of this logger
    const aliases = {}; // aliased for substreams (e.g. warn same as warning)

    // all stream & alias names are normalized (e.g. spaces and camelNotation to dashes)
    const normalize = name => name.replace(/\s+/g,'-').replace(/[a-z][A-Z]/g, m => `${m[0]}-${m[1].toLowerCase()}`);

    // is log stream live/enabled [changed via iffer() function (below)]
    let enabled = true; // can be true, false, or a function

    let consoleOptions = defaultUtilInspectOpts;
    let tracing = false;
    let mainPrefix = '***'; // when root log writes to its own console

    // how a log entry is generated
    const defaultFormatter = (...args) => toDebugString(consoleOptions || defaultUtilInspectOpts, ...args);

    // set via setFormatter
    let formatter = defaultFormatter;

    const loggerName = () => isRoot(lvl) ? singletonAppID : parent[streamNameProp] + '.' + name;

    let filename, wrEntry; // initialized right below...
    onAppIDChanged(newAppID => {
        filename = genLogFileFullName(newAppID, name, lvl, parent);
        wrEntry = setFileOptions();
    });

    function actualLogger(...args) {
        const shouldLog = enabled === true || (enabled === false ? false : enabled(...args));
        if (shouldLog) {
            if (isRoot(lvl))
                CONSOLE_LOG(mainPrefix, ...args); // root log ALWAYS goes to app's main console
            else 
                wrEntry(tracing ? formatter(...args, '\n...', extractStack()) : formatter(...args));
        }
        return loggerProxy; // important
    }

    const setters = {
        setApp, // most important
        setFormatter, // also a filter (when returns undefined log entry not logged)
        setEnabled, // short for .if()
        setAlias, // e.g. log to 'warning' stream when using alias 'warn' stream

        setMainPrefix(pre) { mainPrefix = pre || ''; },

        setColorInFiles(flag = true) { consoleOptions.colors = flag; },
        setConsoleOptions(options) { consoleOptions = options || defaultUtilInspectOpts; },
        setSync(flag = true) { useSyncMethod = flag },
        setTracing(flag = false) { tracing = flag; }, // log entry adds where it was logged from

        setFileOptions,
        setConsoleRedirect,
    }

    function setx(...opts) {
        if (opts.length === 0) // no args to get back current settings
            return { name, fullname: loggerName(), filename, appID: singletonAppID, enabled,
                mainPrefix, consoleOptions, tracing, formatter, streams, aliases };

        for (const optx of opts)
            for (const [k,v] of Object.entries(optx)) {
                const setter = 'set' + k[0].toUpperCase() + k.substring(1);
                (setter in setters) && setters[setter](v);
            }

        return loggerProxy;
    }

    function setApp(appIDorFileName) {
        const appID = (appIDorFileName + '')// could be a filename so extract from it
            .replace(/[/]index[.]js$/,'') // remove trailing /index.js (if any)
            .replace(/[.]js$/,'') // remove trailing .js
            .replace(/.*?[/]([^/]+)$/, '$1') // keep last part of the path (i.e. /no/no/no/no/yes)
            .replace(/\s+/g, '-') // remove blank spaces
            .replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase()); // camel to dash

        setAppID(appID);
    }

    function setFormatter(formatterFcn) {

        // function to set; anything else (incl nothing) to reset to default
        // if function, it should return:
        // - string to log as is (includes an empty string)
        // - undefined to NOT log (so filtered out)
        // - array to use as "new" args (i.e. instead of original args)
        //      - useful when want to add, change, or remove args
        //      - at that point, defaultFormatter used on new args
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

        // todo: document features of this function (attached props, .if shorthand for .set(enabled), .if(once, ...))

        function ifx(cond, ...args) {
            if (args.length === 0) { // setting for that stream
                setEnabled(cond); // .if(cond) as shorthand for .set({enabled:cond});
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

            // can't actually replace 'console' so take over each [important] function
            // also, console.X methods do NOT return anything so must adhere to that

            CONSOLE_OVERRIDE = true;

            let proxy = loggerProxy; // use me as substream (implicit, default), or...
            if (typeof streamName === 'string') { // ...use a separate substream for it (explicit)
                streamName.trim().split(/[.]+/).map(normalize).forEach(substream => proxy = proxy[substream]);
            }

            console.log = (...args) => { proxy(...args); };
            'error info warning debug'.split(/\s+/).forEach(s => console[s] = (...args) => { proxy[s]; });
            console.warn = proxy.warning; // alias
        }            
        else if (!streamName) {
            // todo: if === null, should this mean to disable output?
            // todo: in the meantime, should allow for console.x.if(false);
            //       - can't right now because proxied logger hidden by anonymous fcn (above)
            CONSOLE_LOG(`SORRY, can't release console (not impl)`);
        }
    }

    function setFileOptions({maxInMB=10, slices=4, deleteOnStart=true, useSync=true, deleteOnExit=true} = {}) {

        // TODO: VERY WEAK SOLUTION/IMPLEMENTATION so need to clean it up
        // todo: split MAX_SIZE into multiple [sub] files (slices) then rotate those so always have 
        //       a "tail" of prior log entries (as newly rotated file starts from 0 length)

        let info; // keeps track of current filename & its known size
        let MAX_LOG_SIZE = maxInMB * 1024 * 1024; // to bytes

        return (arguments.length === 0) ? wrLog : (wrEntry = wrLog);

        function rmFile() {
            try { fs.unlinkSync(filename); } catch {}// do NOT simply overwrite else viewer won't detect
            return { filename, size: 0 };
        }

        function getFileInfo() {
            try {
                return { filename, size: fs.statSync(filename).size }
            }
            catch { // for now, just assume file not created yet
                return { filename, size: 0 }
            }    
        }

        function recycle(newAmount) {
            if (!info || info.filename !== filename) {

                // first time OR file changed

                fs.mkdirSync(dirname(filename), { recursive: true }); // always
                info = (deleteOnStart && !info) ? rmFile() : getFileInfo(); // then

                if (deleteOnExit) {
                    const file = filename; // capture current value (may change later)
                    ibedone.on('done', () => { try {  fs.unlinkSync(file); } catch {} });
                }
            }
            info.size += newAmount;
            (info.size > MAX_LOG_SIZE) && (info = rmFile());
        }

        function wrLog(entry) {
            if (entry === undefined) return;
            recycle(entry.length + 1);
            if (useSync)
                fs.appendFileSync(filename, '\n' + entry);
            else
                fs.appendFile(filename, '\n' + entry, err => {
                    err && CONSOLE_LOG('SORRY, error writing to log', filename, entry, err);
                });
        }
    }

    const loggerProxy = new Proxy(()=>{}, {

        // note: proxy target MUST be a function (above) so the apply method (below) is called
        // - only the type matters, namely that it's a function
        // - the actual function itself is immaterial so anonymous will do (i.e. ()=>{})
        // - since it's otherwise unused by us (i.e. what becomes the 'target' in methods below),
        //   we use it to keep track of the user's custom props (if any)

        get(target, prop) {
            // public props (so can't be used as actual stream names)
            if (prop === 'log') return loggerProxy;
            if (prop === 'if') return iffer(); // shorthand for .set({enabled:...})
            if (prop === 'set') return setx;

            // private props (why we use symbols)
            if (prop === streamNameProp) return loggerName();
            if (prop === streamFileNameProp) return filename;
            if (prop === aliasesProp) return aliases;

            // give user-defined (i.e. custom) props priority over streams
            if (prop in target) return target[prop]; // use otherwise-unused target for storage

            if (prop in streams) return streams[prop]; // a stream is proxied function
            if (prop in aliases) return aliases[prop]; // alias for existing stream

            if (typeof prop !== 'string') return undefined; // e.g. symbol

            // create new stream: prop is how user knows this stream (so streams[prop] below)...
            const name = normalize(prop); // ...but name is how the FS will know it
            return streams[prop] = createLogger({ name, parent: loggerProxy, lvl: lvl+1 });
        },
        apply(target, thisArgs, args) {
            return actualLogger(...args);
        },
        set(target, prop, value) {
            target[prop] = value; // use our otherwise-unused target for storage
            return true; // important (assignement success) else node error
        },
        deleteProperty(target, prop) {
            // todo: maybe allow STREAMS to be deleted?
            // - any purpose fo it? maybe to close a log? security risk?
            // for now just allow delete of custom props
            (prop in target) && delete target[prop];
            return true; // reflects delete was accepted
        },
    });

    return loggerProxy;
}

// the ROOT logger for an app
const log0 = createLogger();

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