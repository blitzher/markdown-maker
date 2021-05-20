const fs = require("fs"); /* for handling reading of files */
const path = require("path"); /* for handling file paths */

require("colors"); /* for adding colours to strings */
const { ArgumentParser } = require("argparse"); /* for parsing clargs */
const { version } = require("../package.json"); /* package version number */
const marked = require("marked");
const choki = require("chokidar");

const commands = require("./commands.js");
const { title } = require("process");

const argParser = new ArgumentParser({
    description: "Markdown bundler, with extra options",
});

//#region command line args
argParser.add_argument("src", {
    help:
        "file to be parsed. If this is a directory, it looks for entry point in the directory, see --entry",
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
    help:
        "set the parser to use '_' as seperator in ids for Table of Content. If the links in the table does not work, this is likely to be the issue.",
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

argParser.get_default()
/* parse some md
 * recursively with extra options */
class Parser {
    static TOKEN = "#md";
    static argParser = argParser;

    getDefaultArgs() {
        return argParser.parse_known_args(["dummy"])[0];
    }
    constructor(filename, clargs, parent) {
        /* this.working_directory */
        this.file = filename;

        /* the parent parser */
        this.parent = parent;

        this.line_num = 0;
        this.wd = path.dirname(filename);

        /* finished blob */
        this.blob = undefined;

        /* all options */
        this.opts = {
            defs: {},
            secs: [],
            depth: 0,
        };



        /* load data from file, if it exists,
         * otherwise, interpret as string */
        this.raw = fs.existsSync(this.file)
            ? fs.readFileSync(this.file, "utf-8") + "\n"
            : this.file;

        if (!clargs) {
            clargs = {};
        }
        /* append all commandline arguments to this */
        Object.assign(this.opts, this.getDefaultArgs());
        Object.assign(this.opts, clargs);
    }

    /**
     * parse wrapper for handling
     * preprocessing, parsing and postprocess
     **/
    parse(callback) {
        if (this.opts.verbose || this.opts.debug) {
            console.log(
                ("parsing " + this.file + ": depth=" + this.opts.depth).magenta
            );
        }

        let __blob;

        /* apply preproccessing to raw file */
        __blob = this.preprocess(this.raw);

        /* main parser instance loop */
        __blob = this.mainparse(__blob);

        /**
         * apply postprocessing after
         * main parse is complete     */
        __blob = this.postprocess(__blob);

        this.blob = __blob;
        if (callback) {
            callback(this.blob);
        }
        return this.blob;
    }

    mainparse(blob) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug("beginning mainparse".blue);
        }
        let __blob = "";

        /* main parser instance loop */
        blob.split("\n").forEach((line, lnum) => {

            this.line_num = lnum;

            /* a split version of line, looking like a section title */
            let sectionized = line.split(" ");

            /* if line looks like a title */
            const titleMatch = line.trim().match(/^(#+) (.+)$/);

            if (titleMatch) {
                if (this.opts.verbose || this.opts.debug)
                    console.log("found toc element: " + sectionized);

                /* implement toc level */
                let level = titleMatch[1].length;

                /**
                 * parse elements of title
                 * such as variables */
                if (level <= this.opts.toc_level) {
                    let title = titleMatch[2]
                        .split(" ")
                        .map((s) =>
                            s.startsWith(Parser.TOKEN)
                                ? this.parseToken(s) : s
                        ).join(" ");

                    this.opts.secs.push({ level, title });

                    if (this.opts.debug) {
                        console.log("updated sections:", { level, title });
                    }
                };

            }

            let __line_tokens = [];
            /* split line into tokens */
            line.split(" ").forEach((token) => {
                /* if token is not #md token,
                 * just add it and continue */
                if (token.startsWith(Parser.TOKEN)) {
                    token = this.parseToken(token);
                }

                __line_tokens.push(token);
            });
            /* put line back properly */
            __blob += __line_tokens.join(" ") + "\n";
        });

        return __blob;
    }

    parseToken(token) {
        /* iterate over all commands,
         * and if command is valid, execute it */

        if (this.opts.verbose || this.opts.debug)
            console.log("found mdtoken: " + token);

        for (let i = 0; i < commands.parse.length; i++) {
            const command = commands.parse[i];

            if (command.valid(token, this)) {
                return command.act(token, this);
            }
        }

        throw new SyntaxError(`Unknown token: ${token}`);
    }

    preprocess(blob) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug("beginning preprocess".blue);
        }
        let __blob = "";
        const lines = blob.split("\n");

        lines.forEach((line) => {
            let __line_tokens = [];
            line.split(" ").forEach((token) => {
                for (const command of commands.preparse) {
                    if (command.valid(token, this)) {
                        token = command.act(token, this);
                    }
                }

                __line_tokens.push(token);
            });
            __blob += __line_tokens.join(" ") + "\n";
        });
        return __blob;
    }

    postprocess(blob) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug("beginning postprocess".blue);
        }
        let __blob = "";
        const lines = blob.split("\n");

        lines.forEach((line) => {
            let __line_tokens = [];
            line.split(" ").forEach((token) => {
                // only look

                for (const command of commands.postparse) {
                    if (command.valid(token, this)) {
                        token = command.act(token, this);
                    }
                }

                __line_tokens.push(token);
            });
            __blob += __line_tokens.join(" ") + "\n";
        });

        /* remove double empty lines */
        __blob = this.remove_double_blank_lines(__blob);
        return __blob;
    }

    gen_toc() {
        let __blob = [];
        let tabSize = 2;
        const beg = "* ";
        const hor = " ".repeat(tabSize);
        const sep = this.opts.use_underscore ? "_" : "-";

        this.opts.secs.forEach((sec) => {
            /* replace special characters by seperator
               that are not in beginning or end*/
            let link = `(#${sec.title
                .replace(/[^\w]+/g, sep)
                .toLowerCase()})`;

            /* strip any remaining special chars from link */

            let __line =
                hor.repeat(sec.level - 1) + beg + `[${sec.title}]${link}`;
            __blob.push(__line);
        });
        return __blob.join("\n");
    }

    remove_double_blank_lines(blob) {
        /* replace all triple newlines, and EOF by double newline */
        blob = blob.replace(/\n{3,}|^\n{2,}|\n{2,}$/g, "\n\n");

        return blob;
    }

    /* output the parsed document to bundle */
    to(bundle, cb) {
        const dir = path.dirname(bundle);
        var called = false;
        if (!cb) cb = () => { }

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.get((blob) => {
            fs.writeFile(bundle, blob, () => {
                if (!called) cb(bundle);
                called = true;
            });
        });

        if (this.opts.html) {
            const htmlFileName = bundle.replace(".md", ".html")
            fs.writeFile(htmlFileName, this.html(), () => { if (!called) cb(htmlFileName); called = true; });
        }
    }

    html(bundle) {

        const htmlFormatted = marked(this.get());

        return htmlFormatted;
    }

    get(callback) {
        if (this.blob) {
            if (callback) {
                callback(this.blob);
            }
            return this.blob;
        } else {
            try {
                let blob = this.parse(callback);
                return blob;
            } catch (error) {

                let traceback = "";
                let p = this;
                do {
                    traceback += `\n...on line ${p.line_num + 1} in ${p.file}`
                        .gray;
                    if (p.parent) p = p.parent;
                } while (p.parent);

                error.message += traceback;

                /* only interested in stacktrace, when debugging */
                if (!this.opts.debug) error.stack = "";

                throw error;
            }
        }
    }
}

module.exports = Parser;

/* main entrypoint */
if (require.main === module) {
    const clargs = argParser.parse_args();



    if (clargs.debug) {
        console.dir(clargs);
    }
    /* in case source is a directory, look for entry in directory */
    if (fs.existsSync(clargs.src) && fs.lstatSync(clargs.src).isDirectory()) {
        clargs.src = path.join(clargs.src, clargs.entry);
    }

    /* helper method for calling parser */
    const compile = (s, o) => {
        const parser = new Parser(s, clargs);
        parser.to(o, (f) => { console.log(`Compiled ${f}`.green) });
        return parser;
    };


    const srcDirName = path.dirname(clargs.src);
    if (!clargs.watch) {
        console.log(srcDirName);
        compile(clargs.src, clargs.output);
    } else {
        const internalCooldown = 1000;

        /* watch the folder of entry */
        console.log(`Watching ${srcDirName} for changes...`.yellow);
        const watcher = choki
            .watch(srcDirName)
            .on("all", (event, path) => {
                if (!this.time) this.time = Date.now();

                const now = Date.now();

                if (now - this.time < internalCooldown) return;

                console.log(`Detected change in ${path}...`);

                try {
                    compile(clargs.src, clargs.output);
                } catch (e) {
                    console.log(e.message);
                }

                this.time = now;

            });
        try {
            compile(clargs.src, clargs.output);
        } catch (e) {
            console.log(e.message);
        }
    }
}
