"use strict"; // keep until es-moduled (read below)

/* Runtime instructions:
   - cd ~/devx/builder && node log0 app-name [stream-name] [stream-name]
*/

// when running as viewer (cmd line) MUST specify APP name as first parm

// todo: option to simply dump everything so far
// todo: options to redump all or start from now (e.g. when restarting during the day)
// todo: option to save logs for the day, week, ...

// - could specify WHICH dir to use (instead of ~/.log0/app-name)

// ALL LOGGING is done to files
// OPTION to ALSO go directly to console for 1 or more of the streams

/*
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
*/

const fs = require('fs'),
      fsp = fs.promises;

const throwe = err => { throw new Error(err); }
const FileNotFound = ex => ex.errno === 2 || /ENOENT/i.test(ex.code || '');

function todayAsYYYYMMDD() {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
    // use above to convert from `2020-05-22T14:48:00.000Z` to `20200522`
    return new Date().toISOString().replace(/T.*|\D+/g, ''); 
}

// log files kept in: userDir/LOG0_APP_DIR/appID` 
const LOG0_APP_DIR = '.log0'; // e.g. `~/.log0/rehtml` for mac & linux
const USE_DATES_FOR_LOGS = false; // not needed since for dev only

function genFileName(streamName) { // todayLogName?
    return (USE_DATES_FOR_LOGS ? `${todayAsYYYYMMDD()}-` : '') + streamName;
}

function genLogFileFullName(appID, streamName) {
    const userDir = require('os').homedir();   
    const logDir = `${userDir}/${LOG0_APP_DIR}/${appID}`;

    // must create dir without waiting, so need flag to indicate ready to write to logs

    //await fsp.mkdir(logDir, { recursive: true }); // always

    return {logDir};
}

function extractStreamName(filename) {
    return USE_DATES_FOR_LOGS ? (filename.match(/^\d{8}[-]([^/]+)$/) || [])[1] : filename;
}

// Are we being required or cmd-line executed?
(require.main === module) && DisplayRunningLogs();

// FOR COMMAND LINE EXECUTION
async function DisplayRunningLogs() {

    const [nodeBinPath, log0AppPath, appID, ...streamNames] = process.argv;

    appID || throwe('need an app name or identifier to listen for logs');

    const userDir = require('os').homedir();
    
    const logDir = `${userDir}/${LOG0_APP_DIR}/${appID}`;
    await fsp.mkdir(logDir, { recursive: true }); // always

    const observeAll = streamNames.length === 0,
          observeSingle = streamNames.length === 1,
          stream = streamNames.reduce((streams,name) => (streams[name] = {
                name, pos:0, file: `${logDir}/${genFileName(name)}`
          }, streams), {});

    function validStream(filename) {
        const name = extractStreamName(filename);
        if (name)
            return (name in stream) ? stream[name]
                : observeAll ? (stream[name] = {pos:0,name,file:`${logDir}/${filename}`})
                : false;

        return false;
    }

    fs.watch(logDir, async (eventType, filename) => {
        const stream = validStream(filename);
        try {            
            stream && await dumpNewEntries(stream);
        }
        catch(ex) {
            FileNotFound(ex) ? (stream.pos = 0) : console.log('whoops', ex.message || ex.error || ex);
        }
    });

    async function dumpNewEntries(stream) {
        const {file, name: streamName} = stream;
        const prefix = observeSingle ? `` : `\n[${streamName}]  `;
        return new Promise((resolve,reject) => {
            if (stream.pos === 0) { // starting fresh so skip past log entries
                fs.stat(file, (err,stats) => {
                    if (err) return reject(err); // likely file deleted by user
                    if (stats.size > 0) {
                        console.log(`[SKIPPING PREVIOUS LOG ENTRIES (${stats.size} bytes) in ${file}]`)
                        stream.pos = stats.size;
                        resolve();
                    }
                });
            }
            else
                fs.createReadStream(file, {start: stream.pos, encoding: 'utf8'})
                    .on('data', data => {
                        process.stdout.write(prefix ? data.replace(/\n/g, prefix) : data);
                        stream.pos += data.length;
                    })
                    .on('error', err => reject(err))
                    .on('end', () => resolve())
                    .on('close', () => {}); // resolve here instead?
        });
    }
}

// WHEN REQUIRED

// based on: https://stackoverflow.com/a/28397970/11256689
// - https://nodejs.org/api/util.html#util_util_inspect_object_options
// - as per this one, only need an 'inpect()' method: https://stackoverflow.com/a/28397970/11256689
const util = require('util'),
      consoleString = util.inspect.custom; // for help while debugging

function toDebugString(...args) { 
    // similar to what's displayed by console.log(...args)
    // based on: https://nodejs.org/api/util.html#util_util_inspect_object_options
    return args.map(a => a === undefined ? '--undefined--' 
                       : a === null ? '--null--'
                       : a === '' ? "''"
                       : typeof a === 'object' ? util.inspect(a, {depth: 2, colors: true}) 
                       : a).join(' ');
}

function logbase(options, subs, ...args) {

    // DOES NOT USE THIS.
    // never called directly in the wild, only by functions below
    // that know to pass 2 extra parms: main options, and suboptions 

    const {appID, streamName} = options;
    const {type} = subs;
    if (appID) {
        const x = `[${appID}.${streamName}]${type?`/${type}`:''}`;
        console.log(x, toDebugString(...args));//?', this.logFile, process.env.npm_package_name, __dirname, process.cwd());
        // console.log(require.main);
        // fs.appendFile(this.logFile, '\n' + toDebugString(...args), err => {
        //     err && console.log('WHAT???', err);
        // });
    }
    else {
        console.log('[PLAIN-LOG]', toDebugString(...args))
    }
}

const log = createLogger(logbase);//, 'stdout'); // NEED an APP-ID

// only 1 console so singleton for all loggers
let CONSOLE_OVERRIDE = false;

function createLogger(logFcnx) {

    const logger = {}; // primary options for this logger (can be overriden below)

    //const logFcn = logFcnx.bind(loggerThis);
    function logFcn(...args) {
        logbase(logger, {}, ...args);
    }

    const def = (methodName, method) => Object.defineProperty(logFcn, methodName, {
            enumerable: false,
            configurable: false,
            writable: false,
            value: method//.bind(loggerThis)
    });

    def('appID', function(appIDx, streamName = 'stdout') {
        // must be called to redirect output to logfiles
        // until called, all output is as per console.log

        // make sure not already set: if so, create a new sub logger?

        const appid = appIDx // may be a filename so extract from it
            .replace(/[/]index[.]js$/,'') // remove trailing /index.js (if any)
            .replace(/[.]js$/,'') // remove trailing .js
            .replace(/.*?[/]([^/]+)$/, '$1'); // keep last part of the path (i.e. /no/no/no/no/yes)
    

        logger.appID = appid;
        logger.streamName = streamName;
        //console.log('sxetting appid', appid, streamName, this);
        return logFcn;
    });

    def('redirectConsole', function(streamName) {
        // can only be called once, after which ALL console.log calls
        // from any module (incl. 3rd party) will be redirected
        if (CONSOLE_OVERRIDE) {
            console.log('SORRY, already overriden!')
        }
        else {
            console.log('CONSOLE redirected to ' + logger.appID + '/' + (streamName || logger.streamName))
        }
        return logFcn;
    });

    def('newStream', streamName => {
        const actual = logger.appID + '.' + streamName;
        return createLogger(logbase).appID(actual);
        // const opts = Object.assign({}, logger);
        // opts.streamName = actual;
    })
    // logFcn.newStream = function(streamName) {
    //     const actualName = this.streamName ? `${this.streamName}.${streamName}` : streamName;
    // }

    logFcn.enableIf = () => {}; // or just enable(x); if x a fcn, reevaluated each time
    logFcn.disableIf = () => {}

    // log/info/debug, error/warning/warn
    //def('info', createLogger(log, 'infox'));
    def('info', (...args) => {

        // are .info .error .warning separate streams? so in separate files?
        // separate substream? (what does this mean?)
        // or same stream but with indicator?

        logbase(logger, {type: 'info'}, ...args);
        return logFcn;
    });

    def('log', (...args) => {

        // are .info .error .warning separate streams? so in separate files?
        // separate substream? (what does this mean?)
        // or same stream but with indicator?

        logbase(logger, {}, ...args);
        return logFcn;
    });


    //logFcn.info = ()=>{}
    logFcn.warning = ()=>{}
    logFcn.error = ()=>{}

    logFcn.takeOverConsole = function() {
        // can/should only be done once by ???
        if (CONSOLE_OVERRIDE) {
            // error: already taken over; do it again?
        }
        else {
            // can't actually replace 'console' but take over each [important] function
            CONSOLE_OVERRIDE = console;

            console.log = ()=>{};
            console.error = ()=>{};
            console.info = ()=>{};
            console.warning = ()=>{};
            console.warn = ()=>{};
            console.debug = ()=>{};
        }
        return logFcn;
    }

    return logFcn;



    //
    // LOGGING: to be cleaned up

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

    log.warning = function(...args) {
        log('[WARNING]', ...args);    
    }

    log.error = function(...args) {
        log('[ERROR]', ...args); // todo: log permanently somewhere
    }

    log.warningWithTrace = function(...args) {
        showInLog(...args) && console.trace('[WARNING]', ...args);
    }

    log.errorWithTrace = function(...args) {
        showInLog(...args) && console.trace('[ERROR]', ...args); // todo: log permanently somewhere
    }

    log.info = function(...args) {
        log('[INFO]', ...args);    
    }


}

module.exports = {
    log,
    log0: log,
    consoleString,
}