#!/usr/bin/env node

// see README.md for usage
// basically, from separate terminal windows:
// - `log0` [to view ALL logs (streams) for unnamed app(s)]
// - `log0 app=my-app` [to view ALL logs (streams) for app named 'my-app']
// - `log0 app=my-app error warning` [to view only the error and warning stream for app named 'my-app']
// - `log0 app=my-app ...error ...warning` [to view my-app streams with names ending in 'error' or 'warning']
// - `log0 app=my-app error... ...warning` [to view my-app streams with names starting with 'error' or ending with 'warning']
// - `log0 app=my-app ...abcxyz... warning.severe` [to view my-app streams with names containing 'abcxyz'; also the warning.severe stream]

// for all of the above, if log0's my-app dir already exists (from a prior run),
// you can use the shorthand form of `log0 my-app [streams here]` (so omit the `app=` bit)

// TODO: monitor ALL directories UNDER .log0 to determine if/when a new APP dir is created

let [nodeBinPath, log0AppPath, ...streamNames] = process.argv;

//const APP_ID = streamNames[0] || 'log0';

const fs = require('fs');
const { getLogDir, FileNotFound, redish, setWindowTitle } = require('./index.js');
const wr = txt => process.stdout.write(txt); // shorthand for below

// let appID, m = (streamNames[0] || 'app=log0').match(/^app[=](.*)/);
// if (m) { // first arg was explicit appID
//     appID = m[1]; // set it
//     streamNames.shift(); // remove from stream directives
// }
// else { // see if first arg a directory (users can skip 'app=')
//     const x = getLogDir(streamNames[0]);
//     appID = fs.existsSync(x) && fs.statSync(x).isDirectory() ? streamNames.shift() : 'log0';
// }

let logDir = `${require('os').homedir()}/.log0`;//getLogDir(appID);
fs.mkdirSync(logDir, { recursive: true }); // always

function getDirectives(appID) {

    // returns        {streams,directives,viewing,setStream} = getDirectives();

    let directives = [], explicitViews = 0, trim = 0, fyi = [];
    const streams = {};//, showAll = explicitViews === 0, defaultDirective = {view: showAll};

    const viewing = name => (directives.find(d => d.applies(name)) || defaultDirective).view;

    function setStream(name) {

        if (name in streams) return streams[name];

        const file = logDir + '/' + name, {size:pos} = fs.statSync(file);
        return streams[name] = {name, file, pos};
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


    return {title,viewing,setStream};
}

const trimName = n => trim ? n.substring(trim).split(/[.]/).filter((n,i) => i !== 0 || n !== 'stdout').join('.') : n;


DisplayRunningLogs();//`${appID} live logs [${(showAll ? 'ALL STREAMS' : fyi.join(';'))}]`);

async function DisplayRunningLogs(title) {

    setWindowTitle('watching all streams');//title);

    // need 2 levels of watching: 1 for new apps, then 1 for each app

    const rootDir = `${require('os').homedir()}/.log0`,
          join = (a,b) => `${a}/${b}`;

    const apps = {};

    function watching(dirx, showTitle) {

        //`${appID} live logs [${(showAll ? 'ALL STREAMS' : fyi.join(';'))}]`);

        const dir = join(rootDir, dirx);
        //const {streams,directives,viewing,setStream} = getDirectives();
        const {title, viewing,setStream} = getDirectives(dirx);
        if (showTitle) setWindowTitle(title);
        console.log('watching', dir);//, directives);
        return fs.watch(dir, async (evt, name) => {
            console.log('something to file', evt, dir + '-->' + name);
            const stream = setStream(filename);;//streams[filename] || setStream(filename);
            try {            
                viewing(stream.name) && await dumpNewEntries(stream);
            }
            catch(ex) {
                FileNotFound(ex) ? (stream.pos = 0) : wr(`${ex.message || ex.error || ex}\n`);
            }
    
        });
    }

    const APP_ID = streamNames[0] || 'log0'; // if nothing specified, watch all streams? or just log0?
    //console.log('possible appid', APP_ID, process.argv);

    const allDirs = fs.readdirSync(rootDir);
    if (allDirs.find(dir => dir === APP_ID)) {
        // watching an existing app: best case
        console.log('watching explicitly-specified and existing single app', APP_ID);
        streamNames.shift(); // now compute which streams
        watching(APP_ID, true);
    }
    else {
        // either app not created yet OR watching streams for log0 (or ALL streams for all apps)
        console.log('watching log0 until another all appears')
        allDirs.forEach(dir => apps[dir] = watching(dir));
        const ALLWATCHED = fs.watch(rootDir, async (eventType, dirname) => {
            if (dirname === APP_ID) {
                console.log('APP now created: watching it (& removing otherwatchers)');
                for (const d in apps) apps[d].close();
                streamNames.shift();
                watching(APP_ID, true);
                ALLWATCHED.close(); // no need to all others anymore
            }
            else if (!(dirname in apps))
                apps[dirname] = watching(dirname); // watching new dir
        });
    }
    return;

    //console.log(apps);
    fs.watch(rootDir, async (eventType, dirname) => {
        if (dirname in apps) {
            console.log('existing dir', eventType, dirname);
        }
        else {
            apps[dirname] = watching(dirname);
        }
        return;

        console.log('dir-event', eventType, filename);
        
        try {
            const x = fs.statSync(join(rootDir, filename));
            if (x.isDirectory()) 
                console.log('...dir what?', filename);
            else
                console.log('...unexpected', filename);
        }
        catch{
            console.log('...LIKELY REMOVED DIR', filename);
        }
        return;
        const stream = streams[filename] || setStream(filename);
        try {            
            viewing(stream.name) && await dumpNewEntries(stream);
        }
        catch(ex) {
            FileNotFound(ex) ? (stream.pos = 0) : wr(`${ex.message || ex.error || ex}\n`);
        }
    });

    return;


    fs.watch(logDir, async (eventType, filename) => {
        // console.log('got', eventType, filename);
        // return;
        const stream = streams[filename] || setStream(filename);
        try {            
            viewing(stream.name) && await dumpNewEntries(stream);
        }
        catch(ex) {
            FileNotFound(ex) ? (stream.pos = 0) : wr(`${ex.message || ex.error || ex}\n`);
        }
    });

    async function dumpNewEntries(stream) {

        // issue (not worth worrying about)
        // if file is deleted by user, it will be correctly monitored when/if re-created
        // (because file watcher thinks of it as a new file [with a different inode id])
        // BUT, if file is trimmed (i.e. its length is reduced, as in rewriting its content),
        // the new content will NOT begin to display until its new length grows greater than
        // what it was before (since existing stream.pos will be larger than the new content, 
        // initially) [that's because file watcher sees SAME file since inode stays the same]

        const displayName = trimName(stream.name);
        const tag = displayName ? `\n[${redish(displayName.toUpperCase())}] ` : '';

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
