#!/usr/bin/env node

// don't display name if stdout (default main console)
// when asking for a stream, display all SUBstreams also (e.g. parsing & parsing.subber)
// - then that main name not displayed ('parsing') only subber

// streamName... for all substreams; -streamName to not display it; [bash: can't use * or !]

const wr = txt => process.stdout.write(txt); // shorthand

let [nodeBinPath, log0AppPath, appID, ...streamNames] = process.argv;

let tagAll = false, isTagDirective = d => /^[+-]tags$/i.test(d), tagDirective = t => t[0] === '+';
if (isTagDirective(appID)) {
    tagAll = tagDirective(appID);
    appID = streamNames.shift();
}
else if (isTagDirective(streamNames[0]))
    tagAll = tagDirective(streamNames.shift());

appID || process.exit(1,wr(`need app's name/identifier to view its running logs\n`));

const fs = require('fs');
const { getLogDir, FileNotFound, redish, setWindowTitle } = require('./index.js');
const logDir = getLogDir(appID);

fs.mkdirSync(logDir, { recursive: true }); // always

let directives = [], numExplicit = 0, single = '';
for (const sn of streamNames) {
    const [, noDisplay, name, , displaySubs] = sn.match(/^([-]?)(((?![.]{3}).)+)([.]{3})?$/) || [];
    noDisplay || (numExplicit++, single = (numExplicit === 1) ? (name + '.') : '');
    directives.push({ applies: n => (n === name || (displaySubs && n.startsWith(name + '.'))), view: !noDisplay});
}

const observeAll = numExplicit === 0, defaultDirective = {view: observeAll};

const viewing = name => (directives.find(s => s.applies(name)) || defaultDirective).view;

setWindowTitle(`${appID} log [${(observeAll ? 'ALL STREAMS' : streamNames.join(';'))}] - ${tagAll?'+tags':'-tags'}`);

const streams = {};

function setStream(name) {
    const file = logDir + '/' + name, {size:pos} = fs.statSync(file);
    return streams[name] = {name, file, pos};
}

fs.readdirSync(logDir).forEach(setStream);

DisplayRunningLogs();

async function DisplayRunningLogs() {

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
        // but, if file is trimmed (i.e. its length is reduced, as in rewriting its content),
        // the new content will NOT begin to display until its new length becomes greater than
        // what it was before (since stream.pos will be larger than the new content, initially)

        // adjust displayed stream name (if needed)
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
