const fs = require("fs"); /* for handling reading of files */
const path = require("path"); /* for handling file paths */

import Colors = require("colors.ts"); /* for adding colours to strings */
import { argParser } from "./cltool";
Colors.enable();
const { ArgumentParser } = require("argparse"); /* for parsing clargs */
const { version } = require("../package.json"); /* package version number */
const marked = require("marked");

const commands = require("./commands.js");
const { title } = require("process");

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
        Object.assign(this.opts);
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

        /* reset sections for beginning parse */
        if (this.opts.depth === 0) this.opts.secs = [];
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
            const title = sec.title.replace(/_/g, " ");

            let __line =
                hor.repeat(Math.max(sec.level - 1, 0)) + beg + `[${title}](#${link})`;
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

export default Parser;
