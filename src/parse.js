const fs = require("fs");
const choki = require("chokidar");
const path = require("path");

const colors = require("colors");
const { ArgumentParser } = require("argparse");
const { version } = require("../package.json");

const commands = require("./commands.js");

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
//#endregion

/* parse some md
 * recursively with extra options */
class Parser {
    static TOKEN = "#md";
    static getDefaultArgs = argParser.get_default;

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

        if (!clargs) {
            clargs = argParser.get_default();
        }

        /* append all commandline arguments to this */
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

        /**
         * load data from file, if it exists,
         * otherwise, interpret as string */
        const raw = fs.existsSync(this.file)
            ? fs.readFileSync(this.file, "utf-8") + "\n"
            : this.file;

        let __blob;

        /* apply preproccessing to raw file */
        __blob = this.preprocess(raw);

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
        let __blob = "";

        /* main parser instance loop */
        blob.split("\n").forEach((line, lnum) => {
            this.line_num = lnum;

            /* a split version of line, looking like a section title */
            let sectionized = line.trim().split(" ");

            /* if line looks like a title */
            const titleMatch = line.match(/(#+) (\w+)/);
            if (titleMatch) {
                if (this.opts.verbose || this.opts.debug)
                    console.log("found toc element: " + sectionized);

                /* implement toc level */
                let level = titleMatch[1].length;
                if (level > this.opts.toc_level) return;

                /**
                 * parse elements of title
                 * such as variables
                 */
                let title = titleMatch[2]
                    .split(" ")
                    .map((s) =>
                        s.startsWith(Parser.TOKEN) ? this.parseToken(s) : s
                    )
                    .join(" ");
                this.opts.secs.push({ level, title });

                if (this.opts.debug) {
                    console.log("updated sections:", this.opts.secs);
                }
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

        throw SyntaxError(`Unknown token: ${token}`);
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
        const stripRegExp = new RegExp("[^\\w" + sep + "]");

        this.opts.secs.forEach((sec) => {
            /* replace special characters by seperator
               that are not in beginning or end*/
            let link = `(#${sec.title
                .replace(/(?:.)\W+(?=.)/g, (m) => `${m[0]}${sep}`)
                .split(stripRegExp)
                .join("")
                .toLowerCase()})`;
            /* strip any remaining special chars from link */

            let __line =
                hor.repeat(sec.level - 1) + beg + `[${sec.title}]${link}`;
            __blob.push(__line);
        });
        return __blob.join("\n");
    }

    remove_double_blank_lines(blob) {
        blob = blob.replace(/\n{3,}|^\n{2,}|\n{2,}$/g, "\n\n");

        return blob;
    }

    /* output the parsed document to bundle */
    to(bundle) {
        const dir = path.dirname(bundle);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.get((blob) => {
            fs.writeFile(bundle, blob, () => {
                console.log(("Compiled " + bundle).green);
            });
        });
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
                    traceback += `\n...on line ${p.line_num + 1} in ${p.file}`.gray;
                    if (p.parent)
                        p = p.parent;
                } while (p.parent);
                out:
                error.message += traceback
                
                throw error;
            }
        }
    }
}

/* main entrypoint */
if (require.main === module) {
    const clargs = argParser.parse_args();

    if (clargs.debug) {
        console.dir(argParser.parse_args());
    }
    /* in case source is a directory, look for main.md in directory */
    if (fs.existsSync(clargs.src) && fs.lstatSync(clargs.src).isDirectory()) {
        clargs.src = path.join(clargs.src, clargs.entry);
    }

    /* helper method for calling parser */
    const compile = (s, o) => {
        const blob = new Parser(s, clargs);
        blob.to(o);
    };

    if (!clargs.watch) {
        compile(clargs.src, clargs.output);
    } else {
        const internalCooldown = 1000;

        /* watch the folder of entry */
        const watcher = choki
            .watch(clargs.src + "/../")
            .on("all", (event, path) => {
                if (!this.time) this.time = Date.now();

                const now = Date.now();

                if (now - this.time > internalCooldown) {
                    console.log(`Detected change in ${path}...`);
                    compile(clargs.src, clargs.output);
                    this.time = now;
                }
            });
        compile(clargs.src, clargs.output);
    }
}

module.exports = Parser;
