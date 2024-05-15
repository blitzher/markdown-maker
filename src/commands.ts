import * as path from "path";
import Parser from "./parser";
import * as fs from "fs";
import templates, { new_template } from "./templates";
import requireRuntime from "require-runtime";
import * as nodeHtmlParser from "node-html-parser";

export class MDMError extends Error {
    match?: RegExpMatchArray;
    constructor(message: string, match?: RegExpMatchArray) {
        super(message);
        this.name = "MDMError";
        this.match = match;
    }
}

export class MDMWarn extends Error {
    match?: RegExpMatchArray;
    constructor(message: string, match?: RegExpMatchArray) {
        super(message);
        this.name = "MDMWarn";
        this.match = match;
    }
}

export type CommandGroupType = {
    preparse: Command[];
    parse: Command[];
    postparse: Command[];
};

export const commands: CommandGroupType = {
    preparse: [],
    parse: [],
    postparse: [],
};

export enum CommandType {
    PREPARSE,
    PARSE,
    POSTPARSE,
}

export enum TargetType {
    HTML,
    MARKDOWN,
}

export class Command {
    validator: RegExp;
    acter: (match: RegExpMatchArray, parser: Parser) => string | void;
    type: CommandType;

    constructor(
        validator: RegExp,
        acter: (match: RegExpMatchArray, parser: Parser) => string | void,
        type: CommandType
    ) {
        validator = new RegExp(validator.source, validator.flags);
        this.validator = validator;
        this.acter = acter;
        this.type = type;

        /* add this function to appropriate file */
        switch (type) {
            case CommandType.PARSE:
                commands.parse.push(this);
                break;
            case CommandType.PREPARSE:
                commands.preparse.push(this);
                break;
            case CommandType.POSTPARSE:
                commands.postparse.push(this);
                break;
        }
    }

    act(match : RegExpMatchArray, parser : Parser) {
        return this.acter(match, parser);
    }
}

/* variable shorthand */
new Command(
    /(\s|^)<(.+)>/,
    (match, parser) => `${match[1]}#mdvar<${match[2]}>`,
    CommandType.PREPARSE
);

/* mddef */
new Command(
    /#mddef< *(.+?) *= *(.+?) *>/ /* first .+ is lazy so as to not match following spaces */,
    (match, parser) => {
        parser.opts.defs[match[1]] = match[2].replace("_", " ");
    },
    CommandType.PARSE
);

/* mdvar */
new Command(
    /#mdvar<(.+?)>/,
    (match, parser) => {
        let value = parser.opts.defs[match[1]];
        if (!value && !parser.opts.allow_undefined)
            throw new MDMError(`Undefined variable: ${match[1]}`);
        return (value = value || `<${match[1]}>`);
    },
    CommandType.PARSE
);

/** mdinclude */
new Command(
    /#mdinclude<([\w.\/-]+)(?:[,\s]+([\w]+))?>/,
    (match, parser) => {
        /* increase the current recursive depth */
        parser.opts.depth++;

        if (parser.opts.depth > parser.opts.max_depth) {
            throw new MDMError("max depth exceeded!");
        }

        /* get the matching group */
        let [_, name, condition] = match;

        /* implement conditional imports */
        if (condition && !parser.opts.args.includes(condition)) return;

        const fsstat = fs.lstatSync(path.join(parser.wd, name));
        if (fsstat.isDirectory()) {
            /* check if a file with the same name of the
             * exists in the folder */

            if (fs.existsSync(path.join(parser.wd, name, `${name}.md`))) {
                name = path.join(name, `${name}.md`);
            } else {
                throw new MDMError(
                    `No entry file found in folder "${name}". Looking for "${name}.md"`
                );
            }
        }

        const recursiveParser = parser.child(path.join(parser.wd, name));

        /* keep the options the same */
        recursiveParser.opts = parser.opts;
        recursiveParser.parent = parser;

        const fileType = path.extname(recursiveParser.file);

        const blob =
            fileType === ".md"
                ? recursiveParser.get(parser.opts.targetType)
                : recursiveParser.raw;

        parser.opts.depth--;
        return blob;
    },
    CommandType.PARSE
);

/* mdlabel */
new Command(
    /#mdlabel<(\d+),\s?(.+)>/,
    (match, parser) => {
        if (parser.opts.targetType !== TargetType.HTML) return "";

        const level = Number.parseInt(match[1]);
        const title = match[2];
        const link = parser.titleId(title);
        parser.opts.secs.push({ level, title });
        return `<span id="${link}"></span>`;
    },
    CommandType.PREPARSE
);

/* mdref */
new Command(
    /#mdref<(.+)>/,

    (match, parser) => {
        for (let i = 0; i < parser.opts.secs.length; i++) {
            let { title } = parser.opts.secs[i];
            if (title === match[1]) break;

            if (i === parser.opts.secs.length - 1)
                throw new MDMError(
                    `Reference to [${match[1]}] could not be resolved!`
                );
        }

        match[1] = match[1].replace("_", " ");
        const link = parser.titleId(match[1]);
        if (parser.opts.targetType === TargetType.HTML)
            return `<a href="#${link}">${match[1]}</a>`;
        else if (parser.opts.targetType === TargetType.MARKDOWN)
            return `[${match[1]}](#${link})`;
    },
    CommandType.PARSE
);

/* mdtemplate */
new Command(
    /#mdtemplate<(\w+?)>/,
    (match, parser) => {
        const template = match[1];
        const replacement = templates[template];

        if (replacement !== undefined) {
            return replacement;
        } else {
            throw new MDMError(`Template \"${template}\" not found!`, match);
        }
    },
    CommandType.PARSE
);

/* mdmaketoc */
new Command(
    /#mdmaketoc(?:<>)?/,
    (match, parser) => parser.gen_toc(),
    CommandType.POSTPARSE
);

/* mdadvhook */
new Command(
    /\#mdhook<(\w+)>([\w\W]+)\#mdendhook<\1>/m,
    (match, parser) => {
        if (!parser.opts.adv_hooks[match[1]])
            throw new MDMError(`No advanced hook found for ${match[1]}`, match);

        const innerElements = match[2].trim();

        /* Run the inner elements through the parser itself */
        const innerParser = parser.child(innerElements);

        /* parse the inner */
        const parsedInner = innerParser.get(parser.opts.targetType).trim();

        /* Find all tagged elements in inner */
        const re = /<(\w+)[\s=\w\"\'-]*>/g;
        const taggedElements = [];
        parsedInner.match(re)?.forEach((tag) => {
            taggedElements.push(tag.slice(1, -1).split(" ")[0]);
        });

        /* Parse and cast the nodeHTMLElement as a regular HTMLElement */
        const root = nodeHtmlParser.parse(parsedInner, {
            voidTag: {
                tags: taggedElements,
                closingSlash: true,
            },
        }) as any as HTMLElement;

        const helper = (node: HTMLElement) => {
            /*  */
            const map: { [tag: string]: HTMLElement } = {};
            for (let tag of taggedElements) {
                const el = node.getElementsByTagName(tag)[0];
                const dataTag = el.toString().match(/data-tag="([\w-]+)"/);

                let htmlTag = "p"; /* default tag */
                if (!dataTag || dataTag[1] == undefined || typeof dataTag[1] !== "string")
                    continue; /* TODO: warn that no tag was added and "p" tag is used */
                else htmlTag = dataTag[1];

                el.tagName = htmlTag;
                el.removeAttribute("data-tag");
                map[tag] = el;
            }
            return map;
        };

        /* Run the hook */
        parser.opts.adv_hooks[match[1]](helper(root));
        
    },
    CommandType.POSTPARSE
);

const loaded_extentions: fs.PathLike[] = [];

function load_extension(parser: Parser, file: fs.PathLike) {
    if (loaded_extentions.includes(file)) return;
    if (fs.existsSync(file)) {
        const extensions = requireRuntime(file);
        loaded_extentions.push(file);
        extensions.main(new_template, new_command);

        if (parser.opts.verbose)
            console.log(`Loaded extensions from ${file}`.yellow);
    } else if (parser.opts.debug) {
        console.log(`No extensions found at ${file}`.red);
    }
}

export function load_extensions(parser: Parser) {
    /* global extention */
    const global_extensions_path = path.join(__dirname, "extensions.js");
    load_extension(parser, global_extensions_path);

    /* project extention */
    const project_extensions_path = path.join(parser.wd_full, "extensions.js");
    load_extension(parser, project_extensions_path);
}

/**
 *
 * @param regex The regex to match the command
 * @param acter The function called when a match is found. Takes two arguments, `match` and `parser`. `match` is the result of the regex match, and `parser` is the parser instance. The function should return the replacement string.
 * @param type When the command should be run. Can be `CommandType.PREPARSE`, `CommandType.PARSE`, or `CommandType.POSTPARSE`. Defaults to `CommandType.PARSE`.
 */
export function new_command(
    regex: RegExp,
    acter: (match: RegExpMatchArray, parser: Parser) => string,
    type?: CommandType
) {
    new Command(regex, acter, type || CommandType.PARSE);
}

export default { commands, load_extensions };
