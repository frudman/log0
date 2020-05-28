#!/usr/bin/env node

const {log0} = require('log0');

log0('Hello World!'); // shows up on console, always

log0.importantInfo('this is need to know only');

const [nodeBinPath, nodeAppPath, iterationsParms] = process.args;

const iterations = Number.parseInt(iterationsParms) || 10000;

while (iterations-- > 0) {
    // log random events to logs
}