const fs = require("fs");
const choki = require("chokidar");
const path = require("path");

const colors = require("colors");
const { ArgumentParser } = require("argparse");
const { version } = require("../package.json");

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
    help:
        "set mdparser to watch for changes\nonly looks for changes in target file/folder.",
});
argParser.add_argument("-uu", "--use-underscore", {
    action: "store_true",
    help:
        "set the parser to use '_' as seperator in ids for Table of content. If the links in the table does not work, this is likely to be the issue.",
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

    constructor(filename, clargs) {
        /* this.working_directory */
        this.file = filename;

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
        Object.assign(this.opts, this.clargs)
    }

    /* parse */
    parse(callback) {
        if (this.opts.verbose || this.opts.debug) {
            console.log(
                ("parsing " + this.file + ": depth=" + this.opts.depth).magenta
            );
        }
        
        const raw = fs.readFileSync(this.file, "utf-8") + "\n";
        let __blob;

        /* apply preproccessing to raw file */
        __blob = this.preprocess(raw);

        /* main parser instance loop */
        __blob = this.mainparse(__blob);

        /* apply postprocessing after 
         * main parse is complete     */
        __blob = this.postprocess(__blob);

        this.blob = __blob;
        if (callback) {
            callback(this.blob);
        }
        return this.blob;
    }

    mainparse(blob) {
        let __blob = ""

        /* main parser instance loop */
        blob.split("\n").forEach((line, lnum) => {
            this.line_num = lnum;

            /* a split version of line, looking like a section title */
            let sectionized = line.trim().split(" ");

            /* if all elements are hashes */
            if (
                sectionized[0][0] === "#" &&
                sectionized[0].split("#").length - 1 === sectionized[0].length
            ) {
                if (clargs.verbose || clargs.debug) {
                    console.log("found toc element: " + sectionized);
                }

                let level = sectionized[0].length;
                /* implement toc level */
                if (level > clargs.toc_level) return;

                let title = line
                    .split(" ")
                    .slice(1)
                    .map((s) =>
                        s.startsWith(Parser.TOKEN) ? this.parseToken(s) : s
                    )
                    .join(" ");
                this.opts.secs.push({ level, title });

                if (clargs.debug) {
                    console.log("updated sections:", this.opts.secs);
                }
            }

            let __line_tokens = [];
            /* split line into tokens */
            line.split(" ").forEach((token) => {
                /* if token is not #md token,
                 * just add it and continue */
                if (!token.startsWith(Parser.TOKEN)) {
                    __line_tokens.push(token);
                    return;
                }

                __line_tokens.push(this.parseToken(token));
            });
            /* put line back properly */
            __blob += __line_tokens.join(" ") + "\n";
        });

        return __blob;
    }

    parseToken(token) {
        let command = token.slice(Parser.TOKEN.length, token.indexOf("<"));
        let argument = token.slice(token.indexOf("<") + 1, token.indexOf(">"));

        if (this.opts.verbose || this.opts.debug) {
            console.log(("found token: " + token).yellow);
        }

        /* switch for handling all commands and
         * arguments passed to this intermediate
         * compiler */
        let name, valu;
        switch (command) {
            case "def":
                name = argument.split("=")[0];
                valu = argument.split("=")[1];
                this.opts.defs[name] = valu;
                return "";

            case "var":
                name = argument;
                if (Object.keys(this.opts.defs).indexOf(name) > -1) {
                    /* replace underscore with space */
                    return this.opts.defs[name].replace("_", " ");
                } else {
                    if (this.opts.verbose || this.opts.debug) {
                        console.error(`undefined variable ${name}`.red);
                    }
                    return "<UNDEFVAR=" + name + ">";
                }
            case "include":
                /* recursively import and parse includes */
                this.opts.depth++;
                if (this.opts.depth >= this.opts.max_depth) {
                    throw new Error("recursion depth exceeded!");
                }

                const recParser = new Parser(path.join(this.wd, argument));
                recParser.opts = this.opts;
                const ret = recParser.get();
                this.opts.depth--;
                return ret;

            case "maketoc":
                return "POSTTASK:TOC";

            default:
                throw SyntaxError(`Unknown token: ${command}`);
        }
    }

    preprocess(blob) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug("beginning preprocess".blue);
        }
        let __blob = "";
        const lines = blob.split("\n");

        lines.forEach(line => {
            let __line_tokens = [];
            line.split(" ").forEach(token => {
                if (token.match(/(?:\s|^)<\w+>/)) {
                    token = "#mdvar" + token;
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
                if (token.startsWith("POST")) {
                    if (this.opts.verbose || this.opts.debug) {
                        console.log(("found postprocess token: " + token).blue);
                    }
                    token = this.postprocessParseToken(token);
                }
                __line_tokens.push(token);
            });
            __blob += __line_tokens.join(" ") + "\n";
        });

        /* remove double empty lines */
        __blob = this.remove_double_blank_lines(__blob);
        return __blob;
    }

    postprocessParseToken(token) {
        let type = token.split(":")[0].slice(4);
        let valu = token.split(":")[1];

        switch (type) {
            case "TASK":
                let task = valu;
                switch (task) {
                    case "TOC":
                        let toc = this.gen_toc();
                        return toc;

                    default:
                        break;
                }
                break;

            default:
                break;
        }
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
                error.message = `ERR: Line ${this.line_num + 1} in ./${this.file}: ` + error.message;
                
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
    /* incase source is a directory, look for main.md in directory */
    if (fs.existsSync(clargs.src) && fs.lstatSync(clargs.src).isDirectory()) {
        clargs.src = path.join(clargs.src, clargs.entry);
    }
    if (!fs.existsSync(clargs.src)) {
        throw new Error(`Could not find ${clargs.src}!`);
    }

    const compile = (s, o) => {
        const blob = new Parser(s);
        blob.clargs = clargs;
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

module.exports = Parser