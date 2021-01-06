const fs = require("fs");
const path = require("path");
const { ArgumentParser } = require("argparse");
const { exit } = require("process");
const { version } = require("./package.json");

const argParser = new ArgumentParser({
    description: "Markdown bundler, with extra options",
});

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
    default: 'main.md'
})

clargs = argParser.parse_args();

if (clargs.debug) {
    console.dir(argParser.parse_args());
}

/* parse some md
 * recursively with extra options */
class Parser {
    static TOKEN = "#md";
    static MAX_DEPTH;
    constructor(filename) {
        /* this.working_directory */
        this.file = filename;
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
        if (clargs.debug) {
            console.log("parsing " + this.file, ": depth=" + this.opts.depth);
        }
        let __blob = "";

        const raw = fs.readFileSync(this.file, "utf-8");

        raw.split("\n").forEach((line) => {
            if (line.trim().startsWith("#")) {
            }

            let __line = [];
            /* split line into tokens */
            line.split(" ").forEach((token) => {
                /* if token is not #md token,
                 * just add it and continue */
                if (!token.startsWith(Parser.TOKEN)) {
                    __line.push(token);
                    return;
                }

                __line.push(this.parseToken(token));
            });
            /* put line back properly */
            __blob += __line.join(" ") + "\n";
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
            console.log("found token: " + token);
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
                return "/* TODO: MAKE TOC */";

            default:
                break;
        }
    }

    postprocess(blob) {
        const lines = blob.split("\n");
        let fixed_lines = [];
        let flag = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line) {
                fixed_lines.push(line);
                flag = 0;
            } else {
                if (flag) {
                    i++;
                } else {
                    fixed_lines.push(line);
                    flag = 1;
                }
            }
        }
        for (let i = 0; i < fixed_lines.length; i++) {
            const line = fixed_lines[i];
            if (!line) {
                fixed_lines[i] = "\n";
            }
        }
        return fixed_lines.join("").trim();
    }

    /* output the parsed document to bundle */
    to(bundle) {
        const dir = path.dirname(bundle);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.get((blob) => {
            /* apply postprocess */

            fs.writeFile(bundle, blob, () => {
                console.log("Compiled " + bundle);
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
            let blob;
            if (callback) {
                blob = this.parse(callback);
            } else {
                blob = this.parse();
            }
            return blob;
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
        throw new Error(`Could not find ${clargs.src}!`)
    }

    const blob = new Parser(clargs.src);

    /* assign max recursion depth of parser */
    Parser.MAX_DEPTH = clargs.max_depth;

    blob.to(clargs.output);
}
