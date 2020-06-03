#!/usr/bin/env node

// see README.md for usage
// basically, from separate terminal windows:
// - `log0` [to view ALL logs (streams) for unnamed app(s)]
// - `log0 my-app` [to view ALL logs (streams) for app named 'my-app']
// - `log0 my-app error warning` [to view only the error and warning stream for app named 'my-app']
// - `log0 my-app ...error ...warning` [to view my-app streams with names ending in 'error' or 'warning']
// - `log0 my-app error... ...warning` [to view my-app streams with names starting with 'error' or ending with 'warning']
// - `log0 my-app ...abcxyz... warning.severe` [to view my-app streams with names containing 'abcxyz'; also the warning.severe stream]

const [nodeBinPath, log0AppPath, ...streamNames] = process.argv;

const fs = require('fs');
const { getLogDir, FileNotFound, redish, setWindowTitle } = require('./index.js');
const wr = txt => process.stdout.write(txt); // shorthand for below

const rootDir = getLogDir();//`${require('os').homedir()}/.log0`,
const join = (a,b) => `${a}/${b}`; // todo: use path.sep

//const logDir = getLogDir();//`${require('os').homedir()}/.log0`;//getLogDir(appID);
fs.mkdirSync(rootDir, { recursive: true }); // always

function getDirectives(appID, logDir) {

    let explicitViews = 0, trim = 0;
    const directives = [], streams = {}, fyi = [];

    //const logDir = getLogDir(appID);

    // helper
    //const trimName = n => trim ? n.substring(trim).split(/[.]/).filter((n,i) => i !== 0 || n !== 'stdout').join('.') : n;
    // needed still? no more stdout; remove first part always? (i!==0)?
    const trimName = n => trim ? n.substring(trim).split(/[.]/).filter((n,i) => i !== 0 || n !== 'stdout').join('.') : n;


    const viewing = strm => (directives.find(d => d.applies(strm.name)) || defaultDirective).view;

    function getStream(name) {

        if (name in streams) return streams[name];

        const file = logDir + '/' + name, {size:pos} = fs.statSync(file); //and APP ID???
        return streams[name] = {name, file, pos}; // ADD .displayName = trimName(stream.name);
    }

    for (const sn of streamNames) {
        const [, f, name] = sn.match(/^([+-]?)(.*)$/) || [];

        const re = new RegExp('^' + name.replace(/[.]{3,}/g, '(.*)') + '$', "i"); // '...' === wildcard
        directives.push({ applies(n) { return re.test(n); }, view: f !== '-'});

        (f === '-') || (trim = (++explicitViews === 1) ? (name.length + 1) : 0);
        fyi.push((f || '+') + name.replace(/[.]{3,}/g, '*')); // display as traditional wildcard
    }

    const showAll = explicitViews === 0, defaultDirective = {view: showAll};

    const title = `${appID} live logs [${(showAll ? 'ALL STREAMS' : fyi.join(';'))}]`


    return {title,viewing,getStream};
}

async function DisplayRunningLogs() {

    // need 2 levels of watching: 1 for new apps, then 1 for each app

    function watching(appID, showTitle) { // returns a cancelable watcher

        const appDir = join(rootDir, appID);
        const {title, viewing, getStream} = getDirectives(appID, appDir);

        showTitle && setWindowTitle(title);

        return fs.watch(appDir, async (evt, filename) => {
            const stream = getStream(filename); // here filename is stream's full name
            try {            
                viewing(stream) && await dumpNewEntries(stream);
            }
            catch(ex) {
                FileNotFound(ex) ? (stream.pos = 0) : wr(`${ex.message || ex.error || ex}\n`);
            }
        });
    }

    const APP_ID = streamNames[0] || 'log0'; // if nothing specified, watch unnamed app (log0)
    const existingDirs = fs.readdirSync(rootDir);
    if (existingDirs.find(dir => dir === APP_ID)) { // best case
        streamNames.shift(); // remove appid (if was there at all)
        watching(APP_ID, true);
    }
    else { // either app not created yet OR watching streams for log0
        const apps = {};
        // start by watching all dirs
        existingDirs.forEach(dir => apps[dir] = watching(dir));
        // then wait for wanted one to possibly appear
        const ALLWATCHED = fs.watch(rootDir, async (eventType, dirname) => {
            if (dirname === APP_ID) {
                for (const d in apps) apps[d].close(); // close all others
                streamNames.shift();
                watching(APP_ID, true);
                ALLWATCHED.close(); // no need to watch main dir anymore
            }
            else if (!(dirname in apps))
                apps[dirname] = watching(dirname); // watching new dir
        });
    }

    async function dumpNewEntries(stream) {

        // issue (not worth worrying about)
        // if file is deleted by user, it will be correctly monitored when/if re-created
        // (because file watcher thinks of it as a new file [with a different inode id])
        // BUT, if file is trimmed (i.e. its length is reduced, as in rewriting its content),
        // the new content will NOT begin to display until its new length grows greater than
        // what it was before (since existing stream.pos will be larger than the new content, 
        // initially) [that's because file watcher sees SAME file since inode stays the same]

        const tag = stream.displayName ? `\n[${redish(stream.displayName.toUpperCase())}] ` : '';

        return new Promise((resolve,reject) => {
            fs.createReadStream(stream.file, {start: stream.pos, encoding: 'utf8'})
                .on('data', data => {
                    wr(tag ? data.replace(/\n/g, tag) : data);
                    stream.pos += data.length;
                })
                .on('error', err => reject(err))
                .on('end', resolve) // no more data (still open) [1st]
                .on('close', resolve); // underlying stream closed [last]
        });
    }
}

DisplayRunningLogs(); // start
