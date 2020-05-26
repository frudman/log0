#!/usr/bin/env node

/* usage: log0 [(+|-)tags] [0 or more (blank separated) stream directives]
    where +tags (default) to prefix all lines with respective stream name
          -tags to prefix with stream name only if not explicitly specified 
                in command line or not 'stdout'
          [stream directives] (when present) have format: [+|-]name[...]
            if no directives, all streams are displayed live
            if any + directive(s), no other stream displayed
            if only - directive(s), all other streams displayed
            where + to display a stream (default)
                  - to NOT display that stream (use when displaying ALL other streams)
            also: ... (trailing) to display that stream AND all its .substreams
*/

let [nodeBinPath, log0AppPath, appID, ...streamNames] = process.argv;

let tagAll = true, isTagDirective = d => /^[+-]tags$/i.test(d), tagDirective = t => t[0] === '+';
if (isTagDirective(appID)) { // used form `log0 +tags appID`
    tagAll = tagDirective(appID);
    appID = streamNames.shift();
}
else if (isTagDirective(streamNames[0]))
    tagAll = tagDirective(streamNames.shift()); // used form `log0 appID +tags`

const wr = txt => process.stdout.write(txt); // shorthand for below
    
appID || process.exit(1, wr(`need app's name/identifier to view its running logs\n`));

const fs = require('fs');
const { getLogDir, FileNotFound, redish, setWindowTitle } = require('./index.js');
const logDir = getLogDir(appID);

fs.mkdirSync(logDir, { recursive: true }); // always

let directives = [], explicitShow = 0, single = '', fyi = [];
for (const sn of streamNames) {
    const [, f, name, , displaySubs] = sn.match(/^([+-]?)(((?![.]{3}).)+)([.]{3})?$/) || [];
    (f === '-') || (single = (++explicitShow === 1) ? (name + '.') : '');
    fyi.push((f || '+') + name + (displaySubs ? '*' : ''));
    directives.push({ applies: n => (n === name || (displaySubs && n.startsWith(name + '.'))), view: f !== '-'});
}

const streams = {}, showAll = explicitShow === 0, defaultDirective = {view: showAll};

const viewing = name => (directives.find(d => d.applies(name)) || defaultDirective).view;

function setStream(name) {
    const file = logDir + '/' + name, {size:pos} = fs.statSync(file);
    return streams[name] = {name, file, pos};
}

fs.readdirSync(logDir).forEach(setStream);

DisplayRunningLogs(`${appID} live logs [${(showAll ? 'ALL STREAMS' : fyi.join(';'))}] (${tagAll?'+':'-'}tags)`);

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
        // (because file watcher thinks of it as a new file [different inode id])
        // BUT, if file is trimmed (i.e. its length is reduced, as in rewriting its content),
        // the new content will NOT begin to display until its new length becomes greater than
        // what it was before (since stream.pos will be larger than the new content, initially)
        // (all because file watcher sees SAME file since inode stays the same)

        const displayName = tagAll ? stream.name 
            : stream.name.substring(single.length).split(/[.]/).filter((n,i) => i !== 0 || n !== 'stdout').join('.');
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
