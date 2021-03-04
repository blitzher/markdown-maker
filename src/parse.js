const fs = require("fs");
const path = require("path");

const colors = require('colors');
const { ArgumentParser } = require("argparse");
const { version } = require("../package.json");



const argParser = new ArgumentParser({
    description: "Markdown bundler, with extra options",
});

/* follow a path into an object */
function follow(obj, path) {
    path.forEach((s) => {
        obj = obj[s];
    });
    return obj;
}

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

const clargs = argParser.parse_args();

if (clargs.debug) {
    console.dir(argParser.parse_args());
}
//#endregion

/* parse some md
 * recursively with extra options */
class Parser {
    static TOKEN = "#md";
    static MAX_DEPTH;

    constructor(filename) {
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
    }

    /* parse */
    parse(callback) {
        if (clargs.verbose || clargs.debug) {
            console.log(("parsing " + this.file +
                         ": depth=" + this.opts.depth).magenta);
        }
        let __blob = "";

        const raw = fs.readFileSync(this.file, "utf-8") + "\n";

        /* main parser instance loop */
        raw.split("\n").forEach((line, lnum) => {
            this.line_num = lnum;
            
            /* a split version of line, looking like a section title */
            let sectionized = line.trim().split(" ");

            /* if all elements are hashes */
            if ( sectionized[0][0] === '#' &&
               ( sectionized[0].split("#").length - 1) === (sectionized[0].length)) {

                if (clargs.verbose || clargs.debug) {
                    console.log("found toc element: " + sectionized);
                }

                let level = sectionized[0].length
                let title = line.split(" ").slice(1).join(" ")
                this.opts.secs.push({level, title});

                if (clargs.debug) {
                    console.log("updated sections:", this.opts.secs)
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
        this.blob = __blob;
        if (callback) {
            callback(this.blob);
        }
        return this.blob;
    }

    parseToken(token) {
        let command = token.slice(Parser.TOKEN.length, token.indexOf("<"));
        let argument = token.slice(token.indexOf("<") + 1, token.indexOf(">"));

        if (clargs.verbose || clargs.debug) {
            console.log( ("found token: " + token).yellow);
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
                    return "<UNDEFVAR=" + name + ">";
                }
            case "include":
                /* recursively import and parse includes */
                this.opts.depth++;
                if (this.opts.depth >= Parser.MAX_DEPTH) {
                    throw new Error("max depth exceeded!");
                }

                const recParser = new Parser(path.join(this.wd, argument));
                recParser.opts = this.opts;
                const ret = recParser.get();
                this.opts.depth--;
                return ret;

            case "maketoc":
                return "POSTTASK:TOC";

            default:
                throw SyntaxError(`Unknown token: ${command}`)
        }
    }

    postprocess(blob) {
        if (clargs.verbose || clargs.debug) {
            console.debug("beginning postprocess".blue);
        }
        let __blob = "";
        const lines = blob.split("\n");

        lines.forEach((line) => {
            let __line_tokens = [];
            line.split(" ").forEach((token) => {
                // only look 
                if (token.startsWith("POST")) {
                    if (clargs.verbose || clargs.debug) {
                        console.log( ("found postprocess token: " + token).blue);
                    }
                    token = this.postprocessParseToken(token);
                }
                __line_tokens.push(token)
            })
            __blob += __line_tokens.join(" ") + "\n";
        })
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
        const beg = "└"
        const hor = "─"

        this.opts.secs.forEach( (sec) => {
            let __line = " ".repeat(sec.level - 1) + beg + " " + sec.title;
            __blob.push(__line);
        })
        return __blob.join("\n");

    }

    remove_double_blank_lines(blob) {
        const lines = blob.split("\n");
        let fixed_lines = [];
        let flag = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line) {
                fixed_lines.push(line);
                flag = false;
            } else {
                if (flag) {
                    i++;
                } else {
                    fixed_lines.push(line);
                    flag = true;   
                }
            }
        }
        
        return fixed_lines.join("\n").trim();
    }

    /* output the parsed document to bundle */
    to(bundle) {
        const dir = path.dirname(bundle);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.get((blob) => {
            /* apply postprocess */
            blob = this.postprocess(blob);
            
            /* remove double empty lines */
            blob = this.remove_double_blank_lines(blob);
            fs.writeFile(bundle, blob, () => {
                console.log( ("Compiled " + bundle).green);
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
                console.error(`ERR: Line ${this.line_num+1} in ./${this.file}`);
                if (clargs.debug) {
                    console.error(error);
                }
            }
        }
    }
}

/* main entrypoint */
if (require.main === module) {
    /* incase source is a directory, look for main.md in directory */
    if (fs.existsSync(clargs.src) && fs.lstatSync(clargs.src).isDirectory()) {
        clargs.src = path.join(clargs.src, clargs.entry);
    }
    if (!fs.existsSync(clargs.src)) {
        throw new Error(`Could not find ${clargs.src}!`);
    }

    const blob = new Parser(clargs.src);

    /* assign max recursion depth of parser */
    Parser.MAX_DEPTH = clargs.max_depth;

    blob.to(clargs.output);
}
