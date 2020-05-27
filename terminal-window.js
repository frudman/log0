"use strict"; // keep until es-moduled

// PROOF OF CONCEPT ONLY: **NOT TESTED** (also, not well constructed)
// I created for dev needs on a project; feel free to augment for your needs
// likely plenty of alternatives available but more fun for me to write this

// shorthand until https://github.com/tc39/proposal-throw-expressions
const throwe = err => { throw (typeof err === 'string') ? new Error(err) : err; }

const { toDebugString, toUnicode, setWindowTitle, } = require('./index.js');

function enableMethodDestructuring(obj) {

    // NOT WELL TESTED: use VERY CAREFULLY!

    // allows for the methods in an object to be destructured while still bound to original object
    // for example:  const {wr, wrln, moveTo} = new TerminalWindow(stdin, stdout);
    // - so that wrln(...) will still work since it's still associated with the original TerminalWindow object

    /* note 1: we use the FIRST PROTOTYPE of that object since, in a class, in its constructor, these
               methods are [already] part of that object's chain
       note 1b: we DO NOT go up further the chain (for now, anyway): more testing needed if want
                to allow for more complex objects (i.e. ObjType extends ParentObj)
       note 1c: WARNING (if/when considering walking the prototype chain), there are LOTS
                of "native" methods to worry about (e.g. __defineGetter__, isPrototypeOf, ...)
       note 2: this function can be called during an object's construtor() call (i.e. new ObjType(...))
    */

    const props = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(obj));
    for (const name in props)
        if (name !== 'constructor' && typeof props[name].value === 'function')
            obj[name] = obj[name].bind(obj);
}

class TerminalWindow {

    // NOT EFFICIENT: use only when DEBUGGING (creates LOTS of overhead objects)

    /* Notes:
        stdin.on('data', ...) will keep process alive UNTIL process.exit() is called EXPLICITLY
        - there is no other way to end the application once stdin.on('data') is called

        WHEN USING TerminalWindow, we use stdin.on('data') BY DEFAULT as a fail-safe ctrl-c trap
        (else user could be unable to get out of the app)

        if using on(data), this will HIDE on(keypress) event
        - keypress event gives "parsed" info (e.g. {meta,ctrl,shift} key status)
        - keypress event will NOT hold application open, however (EVEN if within a promise
            that is yet to be resolved; not sure why; TBI)
        - if must use keypress event, need to create a READLINE interface (even if don't use it)
            then, to end process, just rl.close() (or process.exit())
    */

    #ctrlActions = [];

    constructor(stdin, stdout) {

        stdin.isTTY || throwe(`Not running in TTY mode\n(e.g. cannot use NODEMON for direct keypress capture)`);
    
        stdin.setEncoding('utf8') // get chars (not buffer)
             .setRawMode(true); // detect each keypress 
    
        Object.assign(this, {stdin,stdout});
        enableMethodDestructuring(this);

        // IMPORTANT: raw mode WILL TRAP CTRL-C so better listen for it (or have other means to quit)
        // read: https://nodejs.org/api/tty.html#tty_readstream_setrawmode_mode

        // Default CTRL-C Trap
        stdin.on('data', kbdInp => { // give a default bailout
            if (kbdInp === TerminalWindow.ctrl.c) {
                this.clearToEndOfWindow();
                if (this.#ctrlActions.length === 0)
                    console.log('\nUSER BREAK (default handler)');
                else while (this.#ctrlActions.length)
                    this.#ctrlActions.shift()(); // NOT ASYNC
                process.exit(0);
            }
        });

        this.fmtOpts = { depth: 2, colors: true, };
    }

    setWindowTitle(title) { setWindowTitle(title); }

    wr(...args) { this.stdout.write(toDebugString(this.fmtOpts, ...args)); return this; }
    wrln(...args) { this.stdout.write(toDebugString(this.fmtOpts, ...args) + '\n'); return this; }


    // IMPORTANT LINKS:
    // - https://nodejs.org/api/tty.html
    // - https://nodejs.org/api/tty.html#tty_readstream_setrawmode_mode
    // - https://nodejs.org/api/readline.html#readline_readline
    // - https://nodejs.org/api/process.html#process_process_versions
    // - https://nodejs.org/api/process.html#process_exit_codes

    // cursor/screen movement: read more at https://nodejs.org/api/tty.html

    // MOVING TO & WRITING to PAST window size (0-line-1, and 0-width-1) simply SEEMS TO leave
    // cursor at the end there (for next writing position);


    moveTo(line, column) { 
        this.stdout.cursorTo(column || 0, line);
        (column === undefined) && this.stdout.clearLine(); 
        return this; 
    }

    clearLine() { this.stdout.clearLine(0); return this; }
    clearToEndOfLine() { this.stdout.clearLine(1); return this; }
    clearToEndOfWindow() { this.stdout.clearScreenDown(); return this; }

    onResize(action) { this.stdout.on('resize', action); return this; }

    windowInfo() { 
        const [width, height] = this.stdout.getWindowSize();
        return {
            width, height, lines: height,
            colorDepth: this.stdout.getColorDepth()
        }
    } 

    onCtrlBreak(action) { this.#ctrlActions.push(action); return this; }

    isArrowKey(str) { 
        for (const v of Object.values(TerminalWindow.arrowKeys))
            if (str === v) return true;
        if (str === TerminalWindow.ctrl.end) return true;
        if (str === TerminalWindow.ctrl.home) return true;
        return false;
    }

    whichArrowKey(str) {
        for (const [n,v] of Object.entries(TerminalWindow.arrowKeys))
            if (str === v) return n;
        if (str === TerminalWindow.ctrl.end) return 'end';
        if (str === TerminalWindow.ctrl.home) return 'home';
        return toUnicode(str);
    }

    static unused_for_ref_only() {
        // use as go.left() or go.right(3) [untested, worked once; BETTER to use TerminalWindow class]
        const go = Object.entries(TerminalWindow.arrowKeys)
            .reduce((sofar,[d,a]) => (sofar[d]=((n=1)=>stdout.write(a.repeat(n))),sofar), {});    
    }

    static arrowKeys = { // stdin input for arrow keys (macOS using iterm2)
        up: `\u001b[A`,
        down: `\u001b[B`,
        right: `\u001b[C`,
        left: `\u001b[D`,
    };

    static ctrl = { // stdin input for some key combos (macOS using iterm2)
        c: '\u0003', // as in ctrl-c
        end: '\u0005', // as in ctrl-E (or END on iterm2)
        home: '\u0001' // as in ctrl-A (or HOME on iterm2)
    }

    static arrowKey(inputChars) {
        for (const [direction,charCombo] in Object.entries(TerminalWindow.arrowKeys))
            if (inputChars === charCombo)
                return {[direction]: true};
        return {};
    }
}

module.exports = {
    TerminalWindow,
}
