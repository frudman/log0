#!/usr/bin/env node

// todo: option to simply dump everything so far (or a partial lead/tail)
// todo: options to redump all or start from now (e.g. if restarting during the day)
// todo: option to save logs for the day, week, always (e.g. yyyymmdd-type archives)
// todo: specify custom dir for logs instead of default '~/.log0/logs/app-name'

const wr = txt => process.stdout.write(txt); // shorthand
const [nodeBinPath, log0AppPath, appID, ...streamNames] = process.argv;

appID || process.exit(1,wr("need app's name/identifier to listen for logs\n"));

const LOG0_APP_DIR = '.log0/logs';
const userDir = require('os').homedir();
const logDir = `${userDir}/${LOG0_APP_DIR}/${appID}`;

const fs = require('fs');
const FileNotFound = ex => ex.errno === 2 || /ENOENT/i.test(ex.code || '');

fs.mkdirSync(logDir, { recursive: true }); // always

DisplayRunningLogs(logDir, streamNames);


async function DisplayRunningLogs(logDir, streamNames) {

    const observeAll = streamNames.length === 0,
          observeSingle = streamNames.length === 1,
          setStream = name => stream[name] = {name, pos:0, file: `${logDir}/${name}`},
          stream = streamNames.reduce((streams,name) => (setStream(name), streams), {});

    const validStream = name => name ? (name in stream) ? stream[name] : observeAll ? setStream(name) : false : false;

    fs.watch(logDir, async (eventType, filename) => {
        const stream = validStream(filename);
        try {            
            stream && await dumpNewEntries(stream);
        }
        catch(ex) {
            FileNotFound(ex) ? (stream.pos = 0) : wr(`${ex.message || ex.error || ex}\n`);
        }
    });

    async function dumpNewEntries(stream) {

        // issue (not worth worrying about)
        // if file is deleted by user, it will be correctly monitored when/if re-created
        // but, if file is trimmed (i.e. its length is reduced, as in rewriting its content),
        // the new content will NOT be displayed unless/until its length is greater than
        // what it was before (since pos, below, will skip over that new content)

        const {file, name, pos} = stream;
        const prefix = observeSingle ? `` : `\n[${name}]  `;
        return new Promise((resolve,reject) => {
            if (pos === 0) { // starting fresh so skip past log entries
                fs.stat(file, (err,stats) => {
                    if (err) return reject(err); // likely file deleted by user
                    if (stats.size > 0) {
                        wr(`\n[SKIPPING PREVIOUS LOG ENTRIES (${stats.size} bytes) in ${file}]\n`)
                        resolve(stream.pos = stats.size);
                    }
                });
            }
            else
                fs.createReadStream(file, {start: pos, encoding: 'utf8'})
                    .on('data', data => {
                        wr(prefix ? data.replace(/\n/g, prefix) : data);
                        stream.pos += data.length;
                    })
                    .on('error', err => reject(err))
                    .on('end', () => resolve())
                    .on('close', () => {}); // resolve here instead?
        });
    }
}
