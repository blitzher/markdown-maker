const fs = require("fs"); /* for handling reading of files */
const path = require("path"); /* for handling file paths */

import Colors = require("colors.ts"); /* for adding colours to strings */
Colors.enable();
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

enum TargetType {
    HTML,
    MARKDOWN,
}

/* parse some md
 * recursively with extra options */
class Parser {
    file: string;
    parent?: Parser;
    line_num: number;
    wd: string;
    blobs: {
        [key: number]: string | undefined;
    };
    opts: {
        defs: {
            [key: string]: string;
        };
        secs: {
            level: number;
            title: string;
        }[];
        depth: number;
        verbose: boolean;
        debug: boolean;
        max_depth: number;
        use_underscore: boolean;
        toc_level: number;
        allow_undef: boolean;
        html: boolean;
        targetType: TargetType | undefined;
    };
    raw: string;

    static TOKEN = "#md";
    static argParser = argParser;

    getDefaultArgs() {
        return argParser.parse_known_args(["dummy"])[0];
    }
    constructor(filename, clargs, parent?) {
        /* this.working_directory */
        this.file = filename;

        /* the parent parser */
        this.parent = parent;

        this.line_num = 0;
        this.wd = path.dirname(filename);

        /* finished blob */
        this.blobs = {};

        /* all options */
        this.opts = {
            defs: {},
            secs: [],
            depth: 0,
            verbose: false,
            debug: false,
            max_depth: 15,
            use_underscore: false,
            toc_level: 3,
            allow_undef: false,
            html: false,
            targetType: undefined,
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
    parse() {
        if (this.opts.verbose || this.opts.debug) {
            console.log(
                Colors.colors(
                    "magenta",
                    "parsing " + this.file + ": depth=" + this.opts.depth
                )
            );
        }

        this.opts.secs = [];

        let __blob;

        /* apply preproccessing to raw file */
        __blob = this.preprocess(this.raw);

        /* main parser instance call */
        __blob = this.mainparse(__blob);

        /**
         * apply postprocessing after */
        __blob = this.postprocess(__blob);

        return __blob;
    }

    mainparse(blob) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug(`beginning mainparse of '${this.file}'`.blue);
        }
        let __blob = "";

        /* main parser instance loop */
        blob.split("\n").forEach((line, lnum) => {
            this.line_num = lnum;

            /* if line looks like a title */
            const titleMatch = line.trim().match(/^(#+) (.+)$/);

            if (titleMatch) {
                if (this.opts.verbose || this.opts.debug)
                    console.log("found toc element: " + line);

                /* implement toc level */
                let level = titleMatch[1].length;

                /**
                 * parse elements of title
                 * such as variables */
                if (level <= this.opts.toc_level) {
                    let title = titleMatch[2]
                        .trim()
                        .split(" ")
                        .map((s) =>
                            s.startsWith(Parser.TOKEN) ? this.parseToken(s) : s
                        )
                        .join("_");

                    this.opts.secs.push({ level, title });

                    if (this.opts.debug) {
                        console.log("updated sections:", { level, title });
                    }
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

        throw new SyntaxError(`Unknown token: ${token}`);
    }

    preprocess(blob) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug(`beginning preprocess of '${this.file}'`.blue);
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
            console.debug(`beginning postprocess of '${this.file}'`.blue);
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

    titleId(title: string) {
        const sep = this.opts.use_underscore ? "_" : "-";

        title = title
            .toLowerCase()
            .replace(/[^\w\s]+/g, "")
            .replace(/[\s_]+/g, sep);
        return title;
    }

    gen_toc() {
        let __blob = [];
        let tabSize = 2;
        const beg = "* ";
        const hor = " ".repeat(tabSize);

        this.opts.secs.forEach((sec) => {
            const link = this.titleId(sec.title);
            const title = sec.title.replace("_", " ");

            let __line =
                hor.repeat(sec.level - 1) + beg + `[${title}](#${link})`;
            __blob.push(__line);
        });
        return __blob.join("\n");
    }

    remove_double_blank_lines(blob) {
        /* replace all triple newlines, and EOF by double newline */
        blob = blob.replace(/(\r\n|\n){3,}/g, "\n\n");

        return blob;
    }

    /* output the parsed document to bundle */
    to(bundle, cb) {
        const dir = path.dirname(bundle);
        var called = false;
        if (!cb) cb = () => {};

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.get(TargetType.MARKDOWN, (blob) => {
            fs.writeFile(bundle, blob, () => {
                if (!called) cb(bundle);
                called = true;
            });
        });

        if (this.opts.html) {
            const htmlFileName = bundle.replace(".md", ".html");
            fs.writeFile(htmlFileName, this.html(), () => {
                if (!called) cb(htmlFileName);
                called = true;
            });
        }
    }

    html() {
        const htmlFormatted = marked(this.get(TargetType.HTML));

        return htmlFormatted;
    }

    get(targetType: TargetType, callback?) {
        if (this.blobs[targetType]) {
            if (callback) {
                callback(this.blobs[targetType]);
            }
            return this.blobs[targetType];
        } else {
            try {
                this.opts.targetType = targetType;
                let blob = this.parse();
                this.opts.targetType = undefined;
                if (callback) callback(blob);
                return blob;
            } catch (error) {
                let traceback = "";

                let p: Parser = this;

                do {
                    traceback += `\n...on line ${p.line_num + 1} in ${
                        p.file
                    }`.grey(15);
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

function main() {
    const clargs = argParser.parse_args();

    /* helper method for calling parser */
    const compile = (s, o) => {
        const parser = new Parser(s, clargs);
        parser.to(o, (f) => {
            console.log(`Compiled ${f}`.green);
        });
        return parser;
    };

    function watcher(event, path) {
        const now = Date.now();

        if (!this.time) this.time = now;

        if (now - this.time < 1000) return;

        console.log(`Detected change in ${path}...`);

        try {
            compile(clargs.src, clargs.output);
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
    if (!clargs.watch) {
        console.log(srcDirName);
        compile(clargs.src, clargs.output);
    } else {
        // const internalCooldown = 1000;

        /* watch the folder of entry */
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

export default Parser;
