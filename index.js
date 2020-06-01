"use strict"; // keep until es-moduled

// see README.md for usage

// DON'T FORGET (from ~/devx/log0):
// 1- increment package.json.version
// 2- make changes
// 3- push to github
// 4- npm publish
// 5- goto 1

// todo: for a heavily used log, keep open stream instead of appending to it as one-offs
// - need to know to close it when app exits (on error or otherwise)

// todo: circular file writing for cleaner recycling
// - need to let viewer know front/back of now-circular file

// todo: MUST MUST ALLOW to specify if log/stream is SYNC or not: matters for fast logging 
// - when order of entries matters (else some later entries may end up ahead of earlier ones)
// - sync also ensures that all logging is complete before app end (e.g. if process.exit called
//   somewhere else; without sync, could leave some log entries unwritten)
//const useSyncMethod = true; // TODO: make as a setting (AND TEST if/when using async/interweaved)


const fs = require('fs');

// shorthand until https://github.com/tc39/proposal-throw-expressions
const throwe = err => { throw (typeof err === 'string') ? new Error(err) : err; }

// below as per: // https://nodejs.org/api/errors.html#errors_common_system_errors
const FileNotFound = ex => ex.errno === 2 || /ENOENT/i.test(ex.code || ''); 

const LOG0_APP_DIR = '.log0'; // e.g. `~/.log0/app-name` for mac & linux
const userDir = require('os').homedir();
const getLogDir = appID => `${userDir}/${LOG0_APP_DIR}/${appID.toLowerCase()}`;

// note: root is a dir (below): no file for "root log" (i.e. log(...)) because its output 
// always goes to console (so app can always explicitly target its main console)
const genLogFileFullName = (appID, streamName, lvl, parent) => 
    lvl === 0 ? getLogDir(appID) // root dir for streams 
              : (parent.filename + (lvl === 1 ? '/' : '.') + streamName.toLowerCase());


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


// used for util.inspect options
const defaultUtilInspectOpts = {depth: 2, colors: true};
function toDebugString(inspectOpts, ...args) { 

    // similar to what's displayed by console.log(...args)
    // based on: https://nodejs.org/api/util.html#util_util_inspect_object_options
    
    // todo: COLORIZE undefined/null/empty-string?

    // why not simply let util.inspect deal directly with each arg?
    return args.map(a => a === undefined ? '--undefined--' 
                       : a === null ? '--null--'
                       : a === '' ? "''"
                       : /object|function/.test(typeof a) ? util.inspect(a, inspectOpts || defaultUtilInspectOpts) 
                       : a.toString()).join(' '); // symbols, primitives
}

function toUnicode(str) {
    return (str || '').split('')
        .map(c => c.charCodeAt().toString(16).toUpperCase().padStart(4, '0'))
        .reduce((unicode,c) => unicode += `\\u${c}`, '');
}

// base console might be changed (i.e. if taken over) so keep original safe
const CONSOLE_LOG = console.log.bind(console);

// only 1 console so singleton for all loggers
let CONSOLE_OVERRIDE = false;

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

function logfileApi(filename, maxSizeInMB = 10) {
    return {
        wr
    }
}

// TODO: VERY WEAK SOLUTION; need something more robust
// todo: make max size a user-defined setting
// todo: split MAX_SIZE into multiple files then rotate those so always have a "tail"
//       of prior log entries (as newly rotated file starts from 0 length)
const monitoredFile = {};
const MAX_LOG_SIZE_IN_MB = 10;
const MAX_LOG_SIZE = MAX_LOG_SIZE_IN_MB * 1024 * 1024; // in bytes
function recycle(file, newAmount) {
    let info = monitoredFile[file];
    if (!info) {
        try {
            info = monitoredFile[file] = { size: fs.statSync(file).size }
        }
        catch(ex) { // for now, just assume file not created yet
            info = monitoredFile[file] = { size: 0 }
        }
    }
    info.size += newAmount;
    if (info.size > MAX_LOG_SIZE) {
        fs.unlinkSync(file); // do NOT simply overwrite else viewer won't detect
        info.size = 0;
    }
}

// can only have one per app & can't change it after (reason below)
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

const streamNameProp = Symbol('stream name'); // symbol to keep internal

function createLogger({name, parent, lvl = 0} = {}) {

    // reserved log props: cannot be used as stream names
    //    log | filename | if | set
    // - but ok to use variants (e.g. IF or Log): stream/filenames will still be lowercase

    // 2 ways to control log entries:
    // - setEnabled (or .if()): entries displayed or not
    // - setFormatter: takes args or computed string and returns string or nothing
    //      - also acts as a filter (i.e. return undefined to NOT log an entry)

    // how a log entry is generated
    const defaultFormatter = (...args) => toDebugString(consoleOptions || defaultUtilInspectOpts, ...args);

    let useSyncMethod = true; // alternative not implemented
    let consoleOptions = defaultUtilInspectOpts;

    // changed via iffer() function (below)
    let enabled = true; // can be true, false, or a function

    // set via setFormatter
    let formatter = defaultFormatter;

    const streams = {}; // substreams of this logger
    const aliases = {};

    const loggerName = () => lvl === 0 ? singletonAppID : parent[streamNameProp] + '.' + name;

    let fileFullName; // set (init) below...
    onAppIDChanged(newAppID => fileFullName = genLogFileFullName(newAppID, name, lvl, parent));

    // proxy target (must be a function)
    function log0Function(){}; // also convenient spot to keep user's custom props

    function actualLogger(...args) {

        let logIt = enabled === true || (enabled === false ? false : enabled(...args));

        if (logIt) {
            if (lvl > 0) { // formatting & filtering here
                const logEntry = formatter(...args);

                if (logEntry === undefined)
                    return; // we're done

                // while testing
                CONSOLE_LOG('['+fileFullName+'] -- ', logEntry); 
                
                // recycle(fileFullName, logEntry.length + 1);

                // if (useSyncMethod)
                //     fs.appendFileSync(fileFullName, '\n' + logEntry);
                // else
                //     fs.appendFile(fileFullName, '\n' + logEntry, err => {
                //         err && CONSOLE_LOG('error writing to log', fileFullName, logEntry, err);
                //     });
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
        setAlias, // e.g. warn=warning; (means warn is same as warning, and warning is to be used)

        setColorInFiles(flag = true) { consoleOptions.colors = flag; },
        setConsoleOptions(options = defaultUtilInspectOpts) { consoleOptions = options; },
        setSync(flag = true) { useSyncMethod = flag },

        // some ideas (to implement soon)
        setRecycling(){},
    }

    function setx(...opts) {
        for (const optx of opts)
            for (const [k,v] of Object.entries(optx)) {
                const setter = 'set' + k[0].toUpperCase() + k.substring(1).toLowerCase();
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

    function setAlias(aliasesStr) {
        // format: a = b; (or a:b;) where b is the actual one to be used
        const aliasesSets = aliasesStr.replace(/\s+/g,'').split(/[,;|]/g);
        for (const alias of aliasesSets) {
            const [a,b] = alias.split(/[=:]/);
            (a && b) && (aliases[a] = b);
        }
    }

    const loggerProxy = new Proxy(log0Function, {
        get(target, prop) {
            if (prop === 'log') return actualLogger;
            if (prop === streamNameProp) return loggerName(); // get from symbol instead (so internal)
            if (prop === 'filename') return fileFullName;
            if (prop === 'if') return iffer(); // shorthand for setEnabled
            if (prop === 'set') return setx;
            
            // give user-defined props priority over streams
            if (prop in log0Function) return log0Function[prop];

            (prop in aliases) && (prop = aliases[prop]);
            if (prop in streams) return streams[prop]; // a proxied function

            if (typeof prop !== 'string') return undefined; // e.g. symbol

            // create new stream
            const streamName = prop.replace(/\s+/g,'-').replace(/[a-z][A-Z]/g, m => `${m[0]}-${m[1].toLowerCase()}`);
            return streams[prop] = createLogger({ name: streamName, parent: loggerProxy, lvl: lvl+1 });
        },
        set(target, prop, value) {
            log0Function[prop] = value;
            return true; // important (assignement success) else node error
        },
        deleteProperty(target, prop) {
            (prop in log0Function) && delete log0Function[prop];
        },
        apply(target, thisArgs, args) {
            return actualLogger(...args);
        }
    });

    return loggerProxy;


    // some ideas (to implement later)...

    // setStreaming(){},
    def('keepOpen', flag => {
        
        // can keep log file open as a stream for higher performance logging (e.g. high volume)

        if (flag) {
            if (!settings.fsStream) {
                settings.fsStream = fs.createWriteStream(settings.fileFullName, { flags: 'a', encoding: 'utf8' });
                process.on('exit', closeMe);        
            }
        }
        else { 
            closeMe(); // ...if open
        }

        function closeme() {
            if (settings.fsStream) {
                settings.fsStream.close();
                settings.fsStream = null;
            }
        }

        return logger;
    });

    def('redirectConsole', function(streamName) {
        // can only be called once, after which ALL console.log calls
        // from any module (incl. 3rd party) will be redirected
        // can/should only be done once by ???
        if (CONSOLE_OVERRIDE) {
            CONSOLE_LOG('SORRY, already overriden!')
        }
        else {
            CONSOLE_LOG('CONSOLE redirected to ' + settings.appID + '/' + (streamName || settings.streamName))

            // can't actually replace 'console' but take over each [important] function
            CONSOLE_OVERRIDE = console;

            // console.X do NOT return  anything so must adhere to that
            console.log = (...args) => { logger(...args); }
            console.error = (...args) => { logger.error(...args); }
            console.info = (...args) => { logger.info(...args); }
            console.warning = (...args) => { logger.warning(...args); }
            console.warn = (...args) => { logger.warning(...args); }
            console.debug = (...args) => { logger.debug(...args); }
        }

        return logger;
    });

    // todo: redirect to somewhere else (incl. multiple destinations; e.g. other file(s), string)

    log.stop = function(exitCode, ...finalMsgs) {
        log(...finalMsgs);
        log(`[DEBUG-STOP]${exitCode === 0 ? '' : ` exit-code=${exitCode}`}`);
        process.exit(exitCode);
    }

    // setTracing(){}, // log with trace or not
    log.warningWithTrace = function(...args) {
        showInLog(...args) && console.trace('[WARNING]', ...args);
    }

    // setTracing(){}, // log with trace or not
    log.errorWithTrace = function(...args) {
        showInLog(...args) && console.trace('[ERROR]', ...args); // todo: log permanently somewhere
    }
}

function getter(obj, prop, getter) {
    Object.defineProperty(obj, prop, { 
        enumerable: false,
        configurable: false,
        get: getter
    })
}

const log0 = createLogger(); // 'root' logger

module.exports = {
    log0,
    log: log0, // alias for convenience

    consoleString,
    throwe,

    // used by viewer
    getLogDir,
    FileNotFound,

    // some useful tidbits
    colorize,
    redish,
    setWindowTitle,

    // more useful tidbits
    toDebugString,
    toUnicode,
}