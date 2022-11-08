import * as path from "path";
import Parser from "./parse";
import * as fs from "fs";
import templates, { new_template } from "./templates";
import requireRuntime from "require-runtime";

export class MDMError extends Error {
    match: RegExpMatchArray;
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
        type: CommandType,
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
    /(\s|^)<(.+)>/,
    (match, parser) => `${match[1]}#mdvar<${match[2]}>`,
    CommandType.PREPARSE,
);

/* mddef */
new Command(
    /#mddef< *(.+?) *= *(.+?) *>/ /* first .+ is lazy so as to not match following spaces */,
    (match, parser) => {
        parser.opts.defs[match[1]] = match[2].replace("_", " ");
    },
    CommandType.PARSE,
);

/* mdvar */
new Command(
    /#mdvar<(.+?)>/,
    (match, parser) => {
        let value = parser.opts.defs[match[1]];
        if (!value && !parser.opts.allow_undefined)
            throw new Error(`Undefined variable: ${match[1]}`);
        return (value = value || `<${match[1]}>`);
    },
    CommandType.PARSE,
);

/** mdinclude */
new Command(
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

        const recursiveParser = new Parser(
            path.join(parser.wd, name),
            parser.opts,
            {
                parent: parser,
            },
        );

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
    CommandType.PARSE,
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
    CommandType.PREPARSE,
);

/* mdref */
new Command(
    /#mdref<(.+)>/,

    (match, parser) => {
        for (let i = 0; i < parser.opts.secs.length; i++) {
            let { title } = parser.opts.secs[i];
            if (title === match[1]) break;

            if (i === parser.opts.secs.length - 1)
                throw new Error(
                    `Reference to [${match[1]}] could not be resolved!`,
                );
        }

        match[1] = match[1].replace("_", " ");
        const link = parser.titleId(match[1]);
        if (parser.opts.targetType === TargetType.HTML)
            return `<a href="#${link}">${match[1]}</a>`;
        else if (parser.opts.targetType === TargetType.MARKDOWN)
            return `[${match[1]}](#${link})`;
    },
    CommandType.PARSE,
);

/* mdtemplate */
new Command(
    /#mdtemplate<([\w\W]+)>/,
    (match, parser) => {
        const template = match[1];
        const replacement = templates[template];

        if (replacement !== undefined) {
            return replacement;
        } else {
            throw new MDMError(`Template \"${template}\" not found!`, match);
        }
    },
    CommandType.PARSE,
);

new Command(
    /#mdmaketoc(?:<>)?/,
    (match, parser) => parser.gen_toc(),
    CommandType.POSTPARSE,
);

export function load_extensions(parser: Parser) {
    /* global extention */
    const global_extensions_path = path.join(process.cwd(), "extensions.js");
    if (fs.existsSync(global_extensions_path)) {
        const extensions = requireRuntime(global_extensions_path);
        extensions.main(new_template, new_command);

        if (parser.opts.verbose)
            console.log(
                `Loaded global extensions from ${global_extensions_path}`
                    .yellow,
            );
    } else if (parser.opts.debug) {
        console.log(
            `No global extensions found at ${global_extensions_path}`.red,
        );
    }

    /* project extention */
    const project_extensions_path = path.join(parser.wd_full, "extensions.js");
    if (fs.existsSync(project_extensions_path)) {
        const extensions = requireRuntime(project_extensions_path);
        extensions.main(new_template, new_command);

        if (parser.opts.verbose)
            console.log(
                `Loaded project extensions from ${project_extensions_path}`
                    .yellow,
            );
    } else if (parser.opts.debug) {
        console.log(
            `No project extensions found at ${project_extensions_path}!`.red,
        );
    }
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
    type?: CommandType,
) {
    new Command(regex, acter, type || CommandType.PARSE);
}

export default { commands, load_extensions };
