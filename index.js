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
const getLogDir = appID => `${userDir}/${LOG0_APP_DIR}/${appID}`;
//const genLogFileFullName = (appID, streamName) => streamName ? (getLogDir(appID) + '/' + streamName) : '';
const genLogFileFullName = (appID, streamName) => getLogDir(appID) + (streamName ? ('/' + streamName) : '');

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
                       : a).join(' '); // symbols, primitives
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

// can only have one per app & can't change it after
let singletonAppID = 'log0', listeners = [];
const onAppIDChanged = action => { action(singletonAppID); listeners.push(action); }
function setAppID(appID) {
    if (singletonAppID === 'log0') {
        CONSOLE_LOG('Setting app id to', appID);
        singletonAppID = appID;
        while (listeners.length)
            listeners.shift()(appID);
    }
    else if (appID !== singletonAppID) {
        // only allow appID to be set once (by presumably controlling app) else other
        // 3rd party modules could change it midstream
        throw new Error(`App ID already set (to /${singletonAppID}) - cannot be changed (to /${appID})`)
    }
}

// base for all: stdout (visible as file name only)
const defBaseLogName = '';//stdout'; // must match regexp below

//function createLogger({name = defBaseLogName, parent} = {}) {
function createLogger({name, parent, lvl = 0} = {}) {

    // reserved log props: cannot be used as stream names
    //    log | name | filename | if | ifNot | set

    let useSyncMethod = true;
    let consoleOptions = defaultUtilInspectOpts;

    const streams = {}; // substreams of this logger

    let fileFullName;
    onAppIDChanged(newAppID => {
        fileFullName = lvl === 0 ? genLogFileFullName(newAppID)
                     : lvl === 1 ? (parent.filename + '/' + name) 
                                 : (parent.filename + '.' + name);
        // fileFullName = name ? (parent.filename + (lvl === 1 ? '/' : '.') + name) 
        //     : genLogFileFullName(newAppID); // this is the root of the logs
    })

    // proxy target (must be a function)
    // also used to keep user's custom props
    function unusedByLog(){};

    function actualLogger(...args) {

        let enabled = true;
        // if ('ifCond' in localSettings) {
        //     const {ifCond} = localSettings;
        //     enabled = ifCond === undefined ? true 
        //         : typeof ifCond === 'function' ? ifCond(...args)
        //         : !!ifCond;
        // }

        if (enabled) {
            if (lvl > 0) {//name) {
                const logEntry = toDebugString(consoleOptions, ...args);

                CONSOLE_LOG('['+fileFullName+'] -- ', logEntry);
                
                // recycle(fileFullName, logEntry.length + 1);

                // if (useSyncMethod)
                //     fs.appendFileSync(fileFullName, '\n' + logEntry);
                // else
                //     fs.appendFile(fileFullName, '\n' + logEntry, err => {
                //         err && CONSOLE_LOG('error writing to log', fileFullName, logEntry, err);
                //     });
            }
            else {
                CONSOLE_LOG("***", ...args);
                // const t = myqqDisplayedName(true).toUpperCase();
                // t ? CONSOLE_LOG(t, ...args) : CONSOLE_LOG(...args);
            }
        }

        return loggerProxy; // important
    }

    function myDisplayedName(squared = false) {
        //const {name, parent, appID} = localSettings;
        const nm = parent ? name : name === defBaseLogName ? '' : name;

        const squareMe = x => squared ? `[${x}]` : x;

        if (parent) 
            return squareMe(`${parent.name}.${name}`);

        return '';

        //return appID ? squareMe(appID + (nm ? `.${nm}` : ``)) : '';
        return singletonAppID === 'log0' ? '' : squareMe(singletonAppID + (nm ? `.${nm}` : ``));
    }

    const setters = {
        setApp, // most important

        setAlias(){}, // e.g. warn and warning

        setConsoleOptions(){},
        setRecycling(){},

        setSync(){}, //
        setStreaming(){},

        setTracing(){}, // log with trace or not

        setFilter(){}, // called on every log entry to change (or remove) log entry (e.g. json)
        setFormatter(){}, // called on every log entry to change (or remove) log entry (e.g. json)

        setEnabled(){}, // ongoing
        setDisabled(){}, // ongoing
    }

    function setApp(appIDorFileName) {

        const appID = (appIDorFileName + '')// may be a filename so extract from it
            .replace(/[/]index[.]js$/,'') // remove trailing /index.js (if any)
            .replace(/[.]js$/,'') // remove trailing .js
            .replace(/.*?[/]([^/]+)$/, '$1') // keep last part of the path (i.e. /no/no/no/no/yes)
            .replace(/\s+/g, '-') // remove blank spaces
            .replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase()); // camel to dash

        // make sure not already set: if so, create a new sub logger?

        setAppID(appID);

        // // WALK BACK TO PARENT
        // if (localSettings.parent)
        //     return localSettings.parent.setApp(appIDorFileName);

        // if ('appID' in localSettings) 
        //     throw new Error('APP ID already set');
        
        // {//}.appID === defBaseAppID) {
        
        //     localSettings.appID = appID
        //     localSettings.fileFullName = genLogFileFullName(appID, localSettings.name);

        //     CONSOLE_LOG('created log:', localSettings.appID, localSettings.fileFullName);
        // }
        // // else {
        // //     // log already set, can't chane mid-course (why not?)
        // //     throw new Error('APP ID already set');
        // // }

        return loggerProxy;
    }

    function setx(...opts) {
        for (const optx of opts)
            for (const [k,v] of Object.entries(optx)) {
                const setter = 'set' + k[0].toUpperCase() + k.substring(1);
                if (setter in setters)
                    setters[setter](v);
                else
                    ; // warning setter ignored
            }
        return loggerProxy;
    }

    function iffer(doOrDont, cond, ...args) {
        const test = typeof cond === 'function' ? cond(...args) : cond;
        (doOrDont ? test : !test) && actualLogger(...args);
        return loggerProxy;

    }

    const loggerProxy = new Proxy(unusedByLog, {
        get(target, prop) {
            if (prop === 'log') return actualLogger;
            if (prop === 'name') return myDisplayedName();
            if (prop === 'filename') return fileFullName;//localSettings.fileFullName;// myFileName();
            if (prop === 'if') return (cond,...args) => iffer(true, cond, ...args);
            if (prop === 'ifNot') return (cond,...args) => iffer(false, cond, ...args);

            if (prop === 'set') return setx;//(...args) => setx(...args);
            if (prop in setters) return setters[prop];
            
            if (prop in streams) return streams[prop]; // a proxied function

            if (prop in unusedByLog) return unusedByLog[prop];

            // create new stream
            // if (localSettings.parent || localSettings.appID) {
                const streamName = prop.replace(/\s+/g,'-').replace(/[a-z][A-Z]/g, m => `${m[0]}-${m[1].toLowerCase()}`);
                const subLogger = streams[prop] = createLogger({ name: streamName, parent: loggerProxy, lvl: lvl+1 });//, apper:localSettings.appID });
                return subLogger;
            // }
            // else {
            //     throw new Error(`must log0.setApp('app-name') before creating new stream '${prop}'`);
            // }
        },
        set(target, prop, value) {
            unusedByLog[prop] = value;
            return true; // important else node error
        },
        deleteProperty(target, prop) {
            (prop in unusedByLog) && delete unusedByLog[prop];
        },
        apply(target, thisArgs, args) {
            return actualLogger(...args);
        }
    });

    return loggerProxy;



    function xlogbase(addtl, ...args) { // need level/type/severity: info, debug, warn/warning, error, critical

        const {fileFullName, fsStream, appID, streamName, consoleOpts } = settings;
        const {type} = addtl; // call-specific options

        const logEntry = toDebugString(consoleOpts, ...args);
    

        if (fsStream) { // eventually (for better performance for high-volume-high-speed logs)
            throw new Error(`NOT IMPL`); 
            //fsStream.write('\n' + logEntry, 'utf8');
            // also ongoing recycling: easier here: could just write back to front of file?
            // - but, need to indicate that file changed for file watchers (somehow)
        }
        else if (fileFullName) {
            recycle(fileFullName, logEntry.length + 1);
            if (useSyncMethod)
                fs.appendFileSync(fileFullName, '\n' + logEntry);
            else
                fs.appendFile(fileFullName, '\n' + logEntry, err => {
                    err && CONSOLE_LOG('error writing to log', fileFullName, logEntry, err);
                });
        }
        else {
            CONSOLE_LOG(`\n[PLAIN-LOG:${appID||'--no-app-id--'}.${streamName||'--no-stream-name--'}]${type?`/${type}`:''}`, logEntry)
        }
    }

    def('colorizeInFiles', (flag = true) => {
        settings.consoleOpts.colors = flag;
        return logger;
    });

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

    // todo: redirect to somewhere else (incl. multiple destinations; e.g. file, string)

    log.stop = function(exitCode, ...finalMsgs) {
        log(...finalMsgs);
        log(`[DEBUG-STOP]${exitCode === 0 ? '' : ` exit-code=${exitCode}`}`);
        process.exit(exitCode);
    }

    log.warningWithTrace = function(...args) {
        showInLog(...args) && console.trace('[WARNING]', ...args);
    }

    log.errorWithTrace = function(...args) {
        showInLog(...args) && console.trace('[ERROR]', ...args); // todo: log permanently somewhere
    }
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