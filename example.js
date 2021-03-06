#!/usr/bin/env node

// first: `[sudo] npm install -g log0` (or `[sudo] npm install -g` if in dir already)
// then: `log0-example` from any other terminal window
// then: `log0` or `log0 sampler` from any other window(s)

// npm list -g log0 to view installation (npm update -g log0)

const log = require('log0');//./index.js'); // MUST `require('log0');` when installed

// plain log() shows up on console, always
log(`Hello World!`);
log(`I'm running from this app: ${__filename}`);
log('Feel free to modify me and experiment further'); 

// give our app a name
// - optional but easier when working on many apps at once
// - then, to view its logs use: `log0 sampler`
const appName = 'sampler'; // can be anything
log.set({app:appName});

// plain log() shows up on console, always
log('...still on the main console for simple log() statements'); 
log(`...to view other logs, on separate terminal windows, type 'log0 ${appName}'`); 
log('then you can ctrl-c (ctrl-break) to quit.')

// any other "stream" (e.g. importantInfo below) can now be viewed using
// `log0 sampler` in another window (can have many such windows for same or other or all streams)
log.importantInfo('this is need to know only');
log.importantInfo('again, this is need to know only');

// for example...
const [nodeBinPath, nodeAppPath, iterationsParms] = process.argv;
let iterations = Number.parseInt(iterationsParms) || 100;

const sleep = timeInMS => new Promise(resolve => setTimeout(resolve,timeInMS));

testLogging(iterations); // log random events to logs
async function testLogging(iterations) {  
    while (iterations-- > 0) {
        await sleep(100);//10);
        log.importantInfo('hello again for the ' + iterations + ' time!');
        log.anotherStream('this is different for the ' + iterations + ' time!');
        log.fancyStream('this is different for the ' + iterations + ' time!');
        log.fancyStream.substream1('this is different for the ' + iterations + ' time!');
        log.fancyStream.substream2('this is different for the ' + iterations + ' time!');
        log.fancyStream.substream2.subsub2b('this is different for the ' + iterations + ' time!');
    }    
}


return;
log('should be directly on console, right?');

log.infox('take 1: asdfasdf');

// init log for all streams
log.set({app:__filename})//.colorizeInFiles(true);

log('app set but this STILL ON CONSOLE, right?');

log.infox('take 2: dsfgdsfgsdf');

log.qwerty.subzero('really loaded stream!', log.qw3erty.subzero.name);
log.qw4erty('some fancy stream, am i right?');
log.info('basic info here');

let a = 1;
log.info.if(a===1, 'A is ONE!!!', log.info.if.disabled);
log.info.if(a===0, 'A is ZERO!!! ERROR IF SHOWN');
log.info.if(() => a===3);
log.info(`If this appears, that's an error!`)
a = 3;
log.info(`If this DOESN'T appear, that's an error!`, log.info.enabled, log.info.disabled)

const logx = log.basic;
logx('this is from logx');

log('now leaving');

log.setApp(__filename)//.colorizeInFiles(true);
log.setApp('pretyop');
log.setApp('pretyop');
log.setApp('pretyop');
log.setApp('pretyop');

log.qPsetxapp('pretyop');
log.qPsetxapp('pretyop');
log.qPsetxapp('pretyop');


log.LOG('pretyop');
log.If('pretyop');
log.SET({app: "not relevant"});
log.SET({app: "not relevant"});
log.SET({app: "not relevant"});
log.SET({app: "not relevant"});

log.if(false).log('error if displayed!');
log('error if displayed!');
log.if(true).log('error if NOT displayed!');

log.info2.if(() => false);
log.info2('error if displayed for log.info2');
log.info2.if(() => true);
log.info2('error if NOT displayed for log.info2');
log.info2.if((...args) => args.length > 1);
log.info2('error if displayed for info2 BECAUSE only a single parm')
log.info2('GOOD if displayed for info2', 123)

log.info2.if((str, ...args) => args.length > 1);
log.info2('error if displayed for info2 BECAUSE only a single parm')
log.info2('error if NOT displayed for info2', 123)

log.info3('hello from 3!');
log.info3.set({formatter(...args) {
    return [new Date(), ...args]; // add time stamp in front
}}).log('hello again from 3: any difference?')
log.info3.set({formatter(str,...args) {
    return str.replace(/\w{4,}/g, '***'); // redact secrets!
}}).log('hello again but now from 3: any difference this time or not?')

log.info3.set({formatter(str,...args) {
    return Symbol(': what??? ' + str.length + '; ' + args.length);//str.replace(/\w{4,}/g, '***'); // redact secrets!
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')

log.info3.set({formatter(...args) {
    return Symbol(': what??? ' + args.length);//str.replace(/\w{4,}/g, '***'); // redact secrets!
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')

log.info3.set({formatter(...args) {
    return true;
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')
log.info3.set({formatter(...args) {
    return 123.456;
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')
log.info3.set({formatter(...args) {
    return false;
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')
log.info3.set({formatter(...args) {
    //return false;
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')
log.info3.set({formatter(...args) {
    return undefined;
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')
log.info3.set({formatter(...args) {
    return {date: new Date(), arbit: 123, args: args};
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')
log.info3.set({formatter(...args) {
    return JSON.stringify({date: new Date(), arbit: 123, args: args}, null, 4);
}}).log('hello again but now from 3: any difference this time or not?', 123, 'abc')

log.warning.set({alias: 'warn warned;;; qwerty'});
log.warn('this is a warning on WARN');
log.warned('and another is warned from WARNED');
log.warning('and FINAL on ACTUAL WARNING');
log.qwerty('coming from qwerty!\n...(NOT aliased because was an existing/PREVIOUSLY CREATED stream', log.set());

log.traced('hello there!').set({tracing:true}).log('and now?');

try {
    throwe('qqq');
}
catch(ex) {
    log.error(ex);
}

log.error2.set({tracing:true}).log('this is an error');

delete log.error2;
delete log.length;
log('LAST???', log.length);

try {
    throwe('qqq');
}
catch(ex) {
    log.error(ex);
}

testForLog();

console.log('direct from log dot console')
//log.infox.potter.set({consoleRedirect: true});
log.set({consoleRedirect: 'infoxqa.potter2.triad3'});
//log.set({consoleRedirect: true});
console.log('redirected from log dot console now???')
console.error('redirect from ERROR log dot console now???')
console.warning('what??? :-)')
console.warn('wh wh what??? :-)')
console.info('from info wh wh what??? :-)')
console.warn.if(false); // how to disable it
console.warn('7wh wh what??? :-)')
console.warn('8wh wh what??? :-)')

log.tres.set({fileOptions:{maxInMB: 5, slices: 7, deleteOnStart: false, deleteOnExit: true}})
log.tres('TRES says pqa');

function testForLog() {
    log.traced('from a function');
}