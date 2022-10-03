import * as path from "path";
import Parser from "./parse";
import * as fs from "fs";
import templates from "./templates";

export class MDMError extends Error {
    match: RegExpMatchArray
    constructor(message: string, match: RegExpMatchArray) {
        super(message);
        this.name = "MDMError";
        this.match = match;
    }
}

export const commands: {
    preparse: Command[];
    parse: Command[];
    postparse: Command[];
} = {
    preparse: [],
    parse: [],
    postparse: [],
};

export const CommandType = {
    PREPARSE: 0,
    PARSE: 1,
    POSTPARSE: 2,
};

export enum TargetType {
    HTML,
    MARKDOWN,
}

export class Command {
    type: number;
    validator: RegExp;
    acter: (match: RegExpMatchArray, parser: Parser) => string | void;

    constructor(
        type,
        validator: RegExp,
        acter: (match: RegExpMatchArray, parser: Parser) => string | void
    ) {
        this.type = type;
        this.validator = validator;
        this.acter = acter;

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

    act(match, parser) {
        return this.acter(match, parser);
    }
}

/* variable shorthand */
new Command(
    CommandType.PREPARSE,
    /(\s|^)<(.+)>/,
    (match, parser) => `${match[1]}#mdvar<${match[2]}>`
);

/* mddef */
new Command(
    CommandType.PARSE,
    /#mddef<(.+)=(.+)>/,
    (m, p) => {
        p.opts.defs[m[1]] = m[2].replace("_", " ");
    }
);

/* mdvar */
new Command(
    CommandType.PARSE,
    /#mdvar<(.+)>/,
    (m, p) => {
        let value = p.opts.defs[m[1]];
        if (!value && !p.opts.allow_undef)
            throw new Error(`Undefined variable: ${m[1]}`);
        return value = value || `<${m[1]}>`;
    }
);

/** mdinclude */
new Command(
    CommandType.PARSE,
    /#mdinclude<([\w.\/-]+)(?:[,\s]+([\w]+))?>/,
    (match, parser) => {
        /* increase the current recursive depth */
        parser.opts.depth++;

        if (parser.opts.depth > parser.opts.max_depth) {
            throw new Error("max depth exceeded!");
        }

        /* get the matching group */
        const [_, name, condition] = match;

        /* implement conditional imports */
        if (condition && !parser.opts.args.includes(condition)) return;

        const recursiveParser = new Parser(path.join(parser.wd, name), parser.opts, {
            parent: parser,
        });

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
    }
);

/* mdlabel */
new Command(
    CommandType.PREPARSE,
    /#mdlabel<(\d+),\s?(.+)>/,
    (match, parser) => {
        if (parser.opts.targetType !== TargetType.HTML) return "";

        const level = Number.parseInt(match[1]);
        const title = match[2];
        const link = parser.titleId(title);
        parser.opts.secs.push({ level, title });
        return `<span id="${link}"></span>`;
    }
);

/* mdref */
new Command(
    CommandType.PARSE,
    /#mdref<(.+)>/,

    (match, parser) => {
        for (let i = 0; i < parser.opts.secs.length; i++) {
            let { title } = parser.opts.secs[i];
            if (title === match[1]) break;

            if (i === parser.opts.secs.length - 1)
                throw new Error(
                    `Reference to [${match[1]}] could not be resolved!`
                );
        }

        match[1] = match[1].replace("_", " ");
        const link = parser.titleId(match[1]);
        if (parser.opts.targetType === TargetType.HTML)
            return `<a href="#${link}">${match[1]}</a>`;
        else if (parser.opts.targetType === TargetType.MARKDOWN)
            return `[${match[1]}](#${link})`;
    }
);

/* mdtemplate */
new Command(
    CommandType.PARSE,
    /#mdtemplate<([\w\W]+)>/,
    (match, parser) => {

        const template = match[1];
        const replacement = templates[template];

        if (replacement !== undefined) {
            return replacement;
        } else {
            throw new MDMError(`Template \"${template}\" not found!`, match);
        }
    }
);

new Command(
    CommandType.POSTPARSE,
    /#mdmaketoc(?:<>)?/,
    (t, p) => p.gen_toc()
);

export function load_extensions(parser: Parser) {
    /* global extention */
    const global_extensions_path = path.join(process.cwd(), "extensions.js");
    if (fs.existsSync(global_extensions_path)) {
        const extensions = require(global_extensions_path);
        extensions.main(templates, Command);

        if (parser.opts.verbose)
            console.log(
                `Loaded global extensions from ${global_extensions_path}`.yellow
            );
    } else if (parser.opts.debug) {
        console.log(
            `No global extensions found at ${global_extensions_path}`.red
        );
    }

    /* project extention */
    const project_extensions_path = path.join(parser.wd_full, "extensions.js");
    if (fs.existsSync(project_extensions_path)) {
        const extensions = require(project_extensions_path);
        extensions.main(templates, Command);

        if (parser.opts.verbose)
            console.log(
                `Loaded project extensions from ${project_extensions_path}`
                    .yellow
            );
    } else if (parser.opts.debug) {
        console.log(
            `No project extensions found at ${project_extensions_path}!`.red
        );
    }
}

export default { commands, load_extensions };
