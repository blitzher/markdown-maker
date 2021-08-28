const fs = require("fs"); /* for handling reading of files */
const path = require("path"); /* for handling file paths */

import Colors = require("colors.ts"); /* for adding colours to strings */
import Parser from "./parse";

Colors.enable();
const { ArgumentParser } = require("argparse"); /* for parsing clargs */
const { version } = require("../package.json"); /* package version number */
const marked = require("marked");
const choki = require("chokidar");

export const argParser = new ArgumentParser({
    description: "Markdown bundler, with extra options",
});

//#region command line args
argParser.add_argument("src", {
    help: "file to be parsed. If this is a directory, it looks for entry point in the directory, see --entry",
});
argParser.add_argument("--version", { action: "version", version });
argParser.add_argument("-v", "--verbose", {
    action: "store_true",
    help: "enable verbose output",
});
argParser.add_argument("-db", "--debug", {
    action: "store_true",
    help: "enable debugging information",
});
argParser.add_argument("-o", "--output", {
    help: "destination of bundle, by default is 'dist/bundle.md'",
    default: "dist/bundle.md",
});
argParser.add_argument("-d", "--max-depth", {
    help: "maximum recursion depth, by default is 15",
    default: 15,
    type: "int",
});
argParser.add_argument("-e", "--entry", {
    help: "assign entry point in directory, by default is 'main.md'",
    default: "main.md",
});
argParser.add_argument("-w", "--watch", {
    action: "store_true",
    help: "recompile after a change in target target file or directory.",
});
argParser.add_argument("-uu", "--use-underscore", {
    action: "store_true",
    help: "set the parser to use '_' as seperator in ids for Table of Content. If the links in the table does not work, this is likely to be the issue.",
});
argParser.add_argument("--toc-level", {
    help: "the section level of the table of contents, by default is 3",
    default: 3,
    type: "int",
});
argParser.add_argument("--html", {
    action: "store_true",
    help: "compile HTML from the parsed markdown",
});
argParser.add_argument("--allow-undef", "-au", {
    action: "store_true",
    help: "allow undefined variables. Mostly useful for typing inline html tags, and other non-strictly markdown related uses",
});
//#endregion

function main() {
    // var server: refreshServer | undefined;
    const clargs = argParser.parse_args();

    /* helper method for calling parser */
    const compile = (s, o, cb?) => {
        const parser = new Parser(s, clargs);
        parser.to(o, (f) => {
            console.log(`Compiled ${f}`.green);
            if (cb) cb();
        });
        return parser;
    };

    const internalCooldown = 1000;
    function watcher(event, path) {
        const now = Date.now();

        if (!this.time) this.time = now;

        if (now - this.time < internalCooldown) return;

        console.log(path);

        console.log(`Detected change in ${path}...`);

        try {
            compile(clargs.src, clargs.output, () => {
                // if (server.refresh) server.refresh();
            });
        } catch (e) {
            console.log(e.message);
        }

        this.time = now;
    }

    if (clargs.debug) {
        console.dir(clargs);
    }
    /* in case source is a directory, look for entry in directory */
    if (fs.existsSync(clargs.src) && fs.lstatSync(clargs.src).isDirectory()) {
        clargs.src = path.join(clargs.src, clargs.entry);
    }

    const srcDirName = path.dirname(clargs.src);

    if (!clargs.watch) compile(clargs.src, clargs.output);

    if (clargs.watch) {
        /* watch the folder of entry */
        // server = wsServer();
        console.log(`Watching ${srcDirName} for changes...`.yellow);

        const _watcher = choki.watch(srcDirName).on("all", watcher);
        try {
            compile(clargs.src, clargs.output);
        } catch (e) {
            console.log(e.message);
        }
    }
}

/* main entrypoint */
if (require.main === module) main();
