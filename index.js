"use strict"; // keep until es-moduled

// ALL LOGGING is done to files
// OPTION to ALSO go directly to console for 1 or more of the streams?

// todo: for a heavily used log, keep open stream instead of appending to it as one-offs
// - need to know to close it when app exits (on error or otherwise)


const fs = require('fs'),
      fsp = fs.promises;

const throwe = err => { throw new Error(err); }
const FileNotFound = ex => ex.errno === 2 || /ENOENT/i.test(ex.code || '');

const LOG0_APP_DIR = '.log0/logs'; // e.g. `~/.log0/logs/app-name` for mac & linux
const userDir = require('os').homedir();
const getLogDir = appID => `${userDir}/${LOG0_APP_DIR}/${appID}`;

function genLogFileFullName(appID, streamName) {
    return getLogDir(appID) + '/' + streamName;
}

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

// used for util.inspect options
const defaultUtilInspectOpts = {depth: 2, colors: true};
function toDebugString(inspectOpts, ...args) { 
    // similar to what's displayed by console.log(...args)
    // based on: https://nodejs.org/api/util.html#util_util_inspect_object_options
    // todo: COLORIZE undefined/null/empty-string?
    return args.map(a => a === undefined ? '--undefined--' 
                       : a === null ? '--null--'
                       : a === '' ? "''"
                       : typeof a === 'object' ? util.inspect(a, inspectOpts || defaultUtilInspectOpts) 
                       : a).join(' ');
}

// base console might be changed, taken over so keep original safe
const CONSOLE_LOG = console.log.bind(console);

process.on('exit', (...args) => {
    // called NOMATTER WHAT (even if unhandled exceptions/rejections)
    // good place to close open streams (if any)
    // - so, when opening a stream, set process.on(exit) to close it
    CONSOLE_LOG('app exiting', args);
})
// process.on('uncaughtException', (...args) => {
//     CONSOLE_LOG('app exiting: UNCAUGHT EXCEPTION', args);

// })
// process.on('unhandledRejection', (...args) => {
//     // yep, it's a thing!
//     CONSOLE_LOG('app exiting: UNHANDLED REJECTION', args);    
// })

// only 1 console so singleton for all loggers
let CONSOLE_OVERRIDE = false;

function createLogger() {

    const settings = {}; // primary options for this logger (can be overriden below)

    function logger(...args) {
        logbase({}, ...args);
    }

    function logbase(addtl, ...args) { // need level/type/severity: info, debug, warn/warning, error, critical

        const {fileFullName, fsStream, appID, streamName } = settings;
        const {type,consoleOpts} = addtl; // call-specific options

        const logEntry = toDebugString(consoleOpts, ...args);

        if (fsStream) {
            fsStream.write('\n' + logEntry, 'utf8');
        }
        else if (fileFullName) {
            fs.appendFile(fileFullName, '\n' + logEntry, err => {
                err && CONSOLE_LOG('error writing to log', fileFullName, logEntry, err);
            });
        }
        else {
            CONSOLE_LOG(`\n[PLAIN-LOG:${appID||'--no-app-id--'}.${streamName||'--no-stream-name--'}]${type?`/${type}`:''}`, logEntry)
        }
    }

    const def = (methodName, method) => Object.defineProperty(logger, methodName, {
            enumerable: false,
            configurable: false,
            writable: false,
            value: method//.bind(loggerThis)
    });

    def('colorize', flag => {
        return logger;
    });

    def('separateLevel', (...levels) => {
        // e.g. error & warning in own file

        return logger;
    });

    def('severity', levels=> {
        return logger;
    });

    def('appID', function(appIDx, streamName = 'stdout') {
        // must be called to redirect output to logfiles
        // until called, all output is as per console.log

        // make sure not already set: if so, create a new sub logger?

        const appID = appIDx // may be a filename so extract from it
            .replace(/[/]index[.]js$/,'') // remove trailing /index.js (if any)
            .replace(/[.]js$/,'') // remove trailing .js
            .replace(/.*?[/]([^/]+)$/, '$1'); // keep last part of the path (i.e. /no/no/no/no/yes)
    

        settings.appID = appID;
        settings.streamName = streamName;

        settings.fileFullName = genLogFileFullName(appID, streamName);

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

            console.log = ()=>{};
            console.error = ()=>{};
            console.info = ()=>{};
            console.warning = ()=>{};
            console.warn = ()=>{};
            console.debug = ()=>{};
        }

        return logger;
    });

    def('newStream', streamName => {
        const pre = settings.streamName === 'stdout' ? '' : (settings.streamName + '.')
        return createLogger().appID(settings.appID, pre + streamName);
    })

    logbase.enableIf = () => {}; // or just enable(x); if x a fcn, reevaluated each time
    logbase.disableIf = () => {}

    // are .info .error .warning separate streams? so in separate files?
    // separate substream? (what does this mean?)
    // or same stream but with indicator?

    def('log', (...args) => (logbase({}, ...args), logger));
    def('info', (...args) => (logbase({type: 'info'}, ...args), logger) );
    def('warning', (...args) => (logbase({type: 'warning'}, ...args), logger) );
    def('error', (...args) => (logbase({type: 'error'}, ...args), logger) );

    return logger;

    // todo: better names: e.g. disable or enable or disableFor or enableFor
    // todo: filter for throwAway() and keepOnly() [e.g. only warning/errors]
    // todo: redirect to somewhere else (incl. multiple destinations; e.g. file, string)
    // todo: create a LOGGER object: same as log but for a specific purpose

    let logThrowAway = false;
    function showInLog() {
        return !logThrowAway;
    }

    function log(...args) {
        showInLog(...args) && console.log(...args);
    }

    log.throwAway = function (flag = true) {
        logThrowAway = flag;
    }

    log.debug = log; // for symmetry with below

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


const log = createLogger();

module.exports = {
    log,
    log0: log,
    consoleString,

    getLogDir,
    FileNotFound,
    colorize,
    redish,
}