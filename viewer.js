#!/usr/bin/env node

// see README.md for usage
const {stdout, argv: [nodeBinPath, log0AppPath, ...streamNames]} = process;

const fs = require('fs'), {join} = require('path');
const fsw = require('chokidar'); // "stabilizer" for fs.watch (important)
const { getLogDir, redish, setWindowTitle } = require('./index.js');

const rootDir = getLogDir();
fs.mkdirSync(rootDir, { recursive: true }); // always

function appDirectives(appID, logDir) { // logDir is specific to appID

    let explicitViews = 0, wildcards = false;
    const logs = {}, directives = [], fyi = [];

    for (const sn of streamNames) {
        const [, f, name] = sn.match(/^([+-]?)(.*)$/) || [];
        (name.indexOf('...') === -1) || (wildcards = true); // '...' === wildcard
        (f === '-') || explicitViews++;
        const re = new RegExp('^' + name.replace(/[.]{3,}/g, '(.*)') + '$', "i"); 
        directives.push({ applies(n) { return re.test(n); }, view: f !== '-'});
        fyi.push((f || '+') + name.replace(/[.]{3,}/g, '*')); // display as traditional wildcard
    }

    const showAll = explicitViews === 0, defaultDirective = {view: showAll};
    const title = `${appID} live logs [${(showAll ? 'ALL STREAMS' : fyi.join(';'))}]`;

    return {title,showStream};

    function viewingStream(filename) {
        if (filename in logs) return logs[filename];
        const name = filename.substring(logDir.length + 1);;
        const viewing = (directives.find(d => d.applies(name)) || defaultDirective).view;
        const tag = viewing && (explicitViews !== 1 || wildcards) && `\n[${redish(name.toUpperCase())}] `;
        return logs[filename] = {tag,viewing,stats:{}};
    }

    async function showStream(filename, newStats) {
        const {tag,viewing,stats} = viewingStream(filename);
        if (viewing) {
            if (stats.ino) { // .ino === .inode (a unique OS id for a file)
                if (stats.ino === newStats.ino && stats.size < newStats.size) { // same file, more content
                    stats.size = await dumpNewEntries(filename, stats.size, tag);
                    return;
                }
            }
            // either new file or file rewritten
            stats.ino = newStats.ino; // save this [new] unique OS id
            stats.size = await dumpNewEntries(filename, 0, tag); // 0 === start from beginning
        }
    }

    async function dumpNewEntries(filename,nextPos,tag) {
        return new Promise((resolve,reject) => {
            fs.createReadStream(filename, {start: nextPos, encoding: 'utf8'})
                .on('data', data => {
                    stdout.write(tag ? data.replace(/\n/g, tag) : data);
                    nextPos += data.length;
                })
                .on('error', err => reject(err))
                .on('end', () => resolve(nextPos)) // no more data (still open) [1st]
                .on('close', () => resolve(nextPos)); // underlying stream closed [last]
        });
    }
}

function showAppLogs(appID) { // returns a cancelable watcher
    const appDir = join(rootDir, appID);
    const {title, showStream} = appDirectives(appID, appDir);
    setWindowTitle(title);
    return fsw.watch(appDir,{alwaysStat:true,depth:1}).on('change', showStream);
}

// START HERE: watch default (i.e. unnamed) app logs
const log0Watcher = showAppLogs('log0');

// then monitor other app dirs in case appID pops up
const otherAppDirs = fsw.watch(rootDir).on('addDir', dir => {
    const appid = dir.substring(rootDir.length + 1)
    if (appid === streamNames[0]) {
        log0Watcher.close(); // not the one we wanted
        showAppLogs(streamNames.shift()); // ctrl-c to cancel
        otherAppDirs.close(); // while we're at it...
    }
});