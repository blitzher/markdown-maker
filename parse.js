const fs = require("fs");
const path = require("path");
const { exit, argv } = require("process");

DEBUG = true;

/* parse some md
 * recursively with extra options */
class Parser {
    static TOKEN = "#md";
    constructor(filename) {
        /* this.working_directory */
        this.file = filename;
        this.wd = path.dirname(filename);

        /* finished blob */
        this.blob = undefined;

        /* definitions */
        this.definitions = {};
    }

    /* parse */
    parse(callback) {
        let __blob = "";

        const raw = fs.readFileSync(this.file, "utf-8");

        raw.split("\n").forEach((line) => {
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
        
        if (DEBUG) {
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
                this.definitions[name] = valu;
                return "";

            case "var":
                name = argument;
                if (Object.keys(this.definitions).indexOf(name) > -1) {
                    /* replace underscore with space */
                    return this.definitions[name].replace("_", " ");
                } else {
                    return "<UNDEFVAR=" + name + ">";
                }
            case "include":
                /* recursively import and parse includes */
                const recParser = new Parser(path.join(this.wd, argument));
                recParser.definitions = this.definitions;
                return recParser.get();

            case "maketoc":
                return "/* TODO: MAKE TOC */";

            default:
                break;
        }
    }

    /* output the parsed document to bundle */
    to(bundle) {
        const dir = path.dirname(bundle);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.get((blob) => {
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

/* get the string value of a name
 * from argv */
function var_argv(name) {
    const index = process.argv.indexOf(name);
    if (index < 0) {
        return "";
    }
    if (argv.length < index) {
        throw new Error(`Option ${name} must have argument!`);
    }
    return process.argv[index + 1];
}

/* main entrypoint */
if (require.main === module) {
    const target = process.argv[2];
    if (!target) {
        throw new Error("No file specified!");
    }

    if (DEBUG) {
        console.log("starting with args: " + process.argv);
    }

    const blob = new Parser(target);

    let out_target = var_argv("-o") ? var_argv("-o") : "dist/bundle.md";

    blob.to(out_target);
}

module.exports = {
    var_argv,
};