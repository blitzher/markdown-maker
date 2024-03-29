const fs = require("fs"); /* for handling reading of files */
const path = require("path"); /* for handling file paths */

import Colors = require("colors.ts"); /* for adding colours to strings */
Colors.enable();
const marked = require("marked");
import { Command, commands, load_extensions, MDMError } from "./commands";

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
    wd_full: string;
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
        args: string[];
        depth: number;
        verbose: boolean;
        debug: boolean;
        max_depth: number;
        use_underscore: boolean;
        toc_level: number;
        allow_undefined: boolean;
        html: boolean;
        watch: boolean;
        targetType: TargetType | undefined;
        only_warn: boolean;
        parent?: Parser;
        isFileCallback: (s: string) => false | string;
    };
    raw: string;

    static TOKEN = "#md";

    constructor(
        filename,
        clargs,
        opts?: {
            parent?: Parser;
            isFileCallback?: (s: string) => false | string;
        }
    ) {
        /* this.working_directory */
        this.file = filename;

        if (!opts) opts = {};

        /* the parent parser */
        this.parent = opts.parent;

        this.line_num = 0;
        this.wd = path.dirname(filename);
        this.wd_full = path.resolve(this.wd);

        /* finished blob */
        this.blobs = {};

        /* all options */
        this.opts = {
            defs: {},
            secs: [],
            args: [],
            depth: 0,
            verbose: false,
            debug: false,
            max_depth: 5,
            use_underscore: false,
            toc_level: 3,
            allow_undefined: false,
            html: false,
            watch: false,
            targetType: undefined,
            only_warn: false,
            parent: undefined,
            isFileCallback: (f) => {
                if (!fs.existsSync(f)) return false;
                return fs.readFileSync(f, "utf-8") + "\n";
            },
        };

        if (!clargs) {
            clargs = {};
        }

        /* append all commandline arguments to this */
        Object.assign(this.opts, clargs);
        Object.assign(this.opts, opts);

        this.raw = this.opts.isFileCallback(filename) || filename;
    }

    /**
     * parse wrapper for handling
     * preprocessing, parsing and postprocess
     **/
    parse() {
        load_extensions(this);
        if (this.opts.verbose || this.opts.debug) {
            console.log(
                Colors.colors(
                    "magenta",
                    "parsing " + this.file + ": depth=" + this.opts.depth
                )
            );
        }

        if (this.opts.debug) {
            console.log("Parsing options:");
            console.log(this.opts);
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

    mainparse(blob: string) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug(`beginning mainparse of '${this.file}'`.blue);
        }

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
                let title = titleMatch[2];

                this.opts.secs.push({ level, title });

                if (this.opts.debug) {
                    console.log("updated sections:", { level, title });
                }
            }
        });

        return this.parse_commands(blob, commands.parse);
    }

    preprocess(blob: string) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug(`beginning preprocess of '${this.file}'`.blue);
        }

        return this.parse_commands(blob, commands.preparse);
    }

    postprocess(blob: string) {
        if (this.opts.verbose || this.opts.debug) {
            console.debug(`beginning postprocess of '${this.file}'`.blue);
        }

        blob = this.parse_commands(blob, commands.postparse);

        /* remove double empty lines */
        blob = this.remove_double_blank_lines(blob);
        blob = blob.trimEnd() + "\n\n";
        return blob;
    }

    parse_commands(blob: string, commands: Command[]) {
        commands.forEach((command) => {
            /* Add global flag to RegExp */
            const re = new RegExp(
                command.validator.source,
                (command.validator.flags || "") + "g"
            );
            blob = blob.replace(re, (...args) => command.act(args, this) || "");
        });
        return blob;
    }

    parse_all_commands(blob: string, commands: { [key: string]: Command[] }) {
        Object.keys(commands).forEach((key) => {
            blob = this.parse_commands(blob, commands[key]);
        });
        return blob;
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
            if (sec.level > this.opts.toc_level) return;
            let title = sec.title.replace(/_/g, " ");
            title = this.parse_all_commands(title, commands);
            const link = this.titleId(title);

            let __line =
                hor.repeat(Math.max(sec.level - 1, 0)) + beg + `[${title}](#${link})`;

            __blob.push(__line);
        });
        return __blob.join("\n");
    }

    line_num_from_index(index: number) {
        return this.raw.substring(0, index).split("\n").length + 1;
    }

    remove_double_blank_lines(blob) {
        /* replace all triple newlines, and EOF by double newline */
        blob = blob.replace(/(\r\n|\n){3,}/g, "\n\n");

        return blob;
    }

    /* output the parsed document to bundle */
    to(bundleName: string, callback: (fileName: string) => void) {
        const dir = path.dirname(bundleName);
        if (callback === undefined) callback = () => { };

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!this.opts.html) {
            this.get(TargetType.MARKDOWN, (blob) => {
                fs.writeFile(bundleName, blob, () => callback(bundleName));
            });
        }

        else {
            const htmlFileName = bundleName.replace(".md", ".html");
            fs.writeFile(htmlFileName, this.html(), () => callback(htmlFileName));
        }
    }

    html() {
        const htmlFormatted = marked(this.get(TargetType.HTML));
        if (this.opts.watch) {
            return (
                `<script>w=new WebSocket("ws:localhost:7788");w.addEventListener("message",(e)=>{if(e.data=="refresh")location.reload();});</script>\n` +
                htmlFormatted
            );
        }
        return htmlFormatted;
    }

    get(targetType?: TargetType, callback?: (blob: string) => void): string {
        /* If target type is undefined, markdown is the default */
        if (targetType === undefined) targetType = TargetType.MARKDOWN;
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
                return blob
            } catch (error) {
                /* Compile a traceback of error */
                let traceback = "";
                let p: Parser = this;

                do {
                    if (error instanceof MDMError)
                        traceback += `\n...on line ${p.line_num_from_index(
                            error.match.index
                        )} in ${p.file}`.grey(15);
                    else traceback += `\n...on line ${p.line_num} in ${p.file}`.grey(15);
                    if (p.parent) p = p.parent;
                } while (p.parent);

                error.message += traceback;

                /* only interested in node stacktrace when debugging */
                if (!this.opts.debug) error.stack = "";

                if (this.opts.only_warn) console.error(error);
                else throw error;
            }
        }
    }
}

export function splice(
    str: string,
    startIndex: number,
    width: number,
    newSubStr: string
) {
    const start = str.slice(0, startIndex);
    const end = str.slice(startIndex + width);
    return start + newSubStr + end;
}

/* add extention to marked for classed blockquotes*/
marked.use({
    renderer: {
        blockquote(quote) {
            /* find the ending, and if not, return the default */
            const ending = quote.match(/\{(.+)\}\s*<\/p>/);
            if (!ending) return `<blockquote>${quote}</blockquote>`;

            const args = ending[1].split(" ");

            const classes = args.filter((arg) => arg.startsWith("."));
            const id = args.filter((arg) => arg.startsWith("#"));

            const classNames = classes.map((c) => c.slice(1));
            const classText = classes.length > 0 ? `class="${classNames.join(" ")}"` : "";
            const idText = id.length > 0 ? `id="${id[0].slice(1)}"` : "";

            /* remove the ending from the quote */
            quote = quote.replace(/\{(.+)\}\s*<\/p>/, "</p>");

            return `<blockquote ${classText} ${idText}>\n${quote.trim()}</blockquote>`;
        },
    },
});

module.exports = Parser;

export default Parser;
