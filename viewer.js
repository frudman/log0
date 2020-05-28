#!/usr/bin/env node

// see README.md for usage

let [nodeBinPath, log0AppPath, ...streamNames] = process.argv;

const fs = require('fs');
const { getLogDir, FileNotFound, redish, setWindowTitle } = require('./index.js');
const wr = txt => process.stdout.write(txt); // shorthand for below

let appID, m = streamNames[0].match(/^app[=](.*)/);
if (m) { // first arg was explicit appID
    appID = m[1]; // set it
    streamNames.shift(); // remove from stream directives
}
else { // see if first arg a directory (users can skip 'app=')
    const x = getLogDir(streamNames[0]);
    appID = fs.existsSync(x) && fs.statSync(x).isDirectory() ? streamNames.shift() : 'log0';
}

let logDir = getLogDir(appID);
fs.mkdirSync(logDir, { recursive: true }); // always

let directives = [], explicitViews = 0, trim = 0, fyi = [];
for (const sn of streamNames) {
    const [, f, name] = sn.match(/^([+-]?)(.*)$/) || [];

    const re = new RegExp('^' + name.replace(/[.]{3,}/g, '(.*)') + '$', "i"); // '...' === wildcard
    directives.push({ applies(n) { return re.test(n); }, view: f !== '-'});

    (f === '-') || (trim = (++explicitViews === 1) ? (name.length + 1) : 0);
    fyi.push((f || '+') + name.replace(/[.]{3,}/g, '*')); // display as traditional wildcard
}

const trimName = n => trim ? n.substring(trim).split(/[.]/).filter((n,i) => i !== 0 || n !== 'stdout').join('.') : n;

const streams = {}, showAll = explicitViews === 0, defaultDirective = {view: showAll};

const viewing = name => (directives.find(d => d.applies(name)) || defaultDirective).view;

function setStream(name) {
    const file = logDir + '/' + name, {size:pos} = fs.statSync(file);
    return streams[name] = {name, file, pos};
}

DisplayRunningLogs(`${appID} live logs [${(showAll ? 'ALL STREAMS' : fyi.join(';'))}]`);

async function DisplayRunningLogs(title) {

    setWindowTitle(title);

    fs.watch(logDir, async (eventType, filename) => {
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
