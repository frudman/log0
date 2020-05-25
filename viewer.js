#!/usr/bin/env node

// todo: option to simply dump everything so far (or a partial lead/tail)
// todo: options to redump all or start from now (e.g. if restarting during the day)
// todo: option to save logs for the day, week, always (e.g. yyyymmdd-type archives)
// todo: specify custom dir for logs instead of default '~/.log0/logs/app-name'

// don't display name if stdout (default main console)
// when asking for a stream, display all SUBstreams also (e.g. parsing & parsing.subber)
// - then that main name not displayed ('parsing') only subber

const wr = txt => process.stdout.write(txt); // shorthand
let [nodeBinPath, log0AppPath, appID, ...streamNames] = process.argv;

let tagAll = false, showTags = /[-]+(tags?|tagall)/i;
if (showTags.test(appID)) {
    tagAll = true;
    appID = streamNames.shift();
}
else if (showTags.test(streamNames[0]))
    tagAll = !!streamNames.shift();

appID || process.exit(1,wr(`need app's name/identifier to view its running logs\n`));

const fs = require('fs');
const { getLogDir, FileNotFound, redish } = require('./index.js');
const logDir = getLogDir(appID);

fs.mkdirSync(logDir, { recursive: true }); // always

DisplayRunningLogs(logDir, streamNames);

async function DisplayRunningLogs(logDir, streamNames) {

    const observeAll = streamNames.length === 0,
          observeSingle = streamNames.length === 1,
          prefix = observeSingle ? streamNames[0].length + 1 : 0,
          streams = {};

    const viewing = name => observeAll || streamNames.find(sn => sn === name || name.startsWith(sn + '.'));

    function setStream(name) {
        const file = logDir + '/' + name, {size:pos} = fs.statSync(file);
        return streams[name] = {name, file, pos, viewing: viewing(name)};
    }

    fs.readdirSync(logDir).forEach(setStream);

    fs.watch(logDir, async (eventType, filename) => {
        const stream = streams[filename] || setStream(filename);
        try {            
            stream.viewing && await dumpNewEntries(stream);
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
            : stream.name.substring(prefix).split(/[.]/).filter((n,i) => i !== 0 || n !== 'stdout').join('.');
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
