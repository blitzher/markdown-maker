import * as path from "path";
import Parser from "./parse";
import * as fs from "fs";
import templates from "./templates";

export const commands = {
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
    validator: (token: string, parser: Parser) => boolean | RegExpMatchArray;
    acter: (token: string, parser: Parser) => string | void;

    constructor(
        type,
        validator: (
            token: string,
            parser: Parser
        ) => boolean | RegExpMatchArray,
        acter: (token: string, parser: Parser) => string | void
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

    valid(token, parser) {
        return this.validator(token, parser);
    }

    act(token, parser) {
        return this.acter(token, parser);
    }
}

/* variable shorthand */
new Command(
    CommandType.PREPARSE,
    (t, p) => t.match(/(?:\s|^)<.+>/),
    (t, p) => `#mdvar` + t
);

/* mddef */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/^#mddef<(.+)=(.+)>/),
    (t, p) => {
        const m = t.match(/^#mddef<(.+)=(.+)>/);
        p.opts.defs[m[1]] = m[2];
    }
);

/* mdvar */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/^#mdvar<.+>/),
    (t, p) => {
        const match = t.match(/#mdvar<(.+)>/);
        let value = p.opts.defs[match[1]];
        if (!value && !p.opts.allow_undef)
            throw new Error(`Undefined variable: ${match[1]}`);
        value = value || `<${match[1]}>`;
        return t.replace(match[0], value.replace("_", " "));
    }
);

/** mdinclude */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/^#mdinclude<([\w.\/-]+)(?:[,\s]+([\w]+))?>/),
    (t, p) => {
        /* increase the current recursive depth */
        p.opts.depth++;

        if (p.opts.depth > p.opts.max_depth) {
            throw new Error("max depth exceeded!");
        }

        /* get the matching group */
        const match = t.match(/^#mdinclude<([\w.\/-]+)(?:[,\s]+([\w]+))?>/);

        const [_, name, condition] = match;

        /* implement conditional imports */
        if (condition && !p.opts.args.includes(condition)) return;

        const recursiveParser = new Parser(path.join(p.wd, name), p.opts, {
            parent: p,
        });

        /* keep the options the same */
        recursiveParser.opts = p.opts;
        recursiveParser.parent = p;

        const fileType = path.extname(recursiveParser.file);

        const blob =
            fileType === ".md"
                ? recursiveParser.get(p.opts.targetType)
                : recursiveParser.raw;

        p.opts.depth--;
        return blob;
    }
);

new Command(
    CommandType.PREPARSE,
    (t, p) => t.match(/#mdlabel<(\d+),([\w\W]+)>/),
    (t, p) => {
        if (p.opts.targetType !== TargetType.HTML) return "";

        const match = t.match(/#mdlabel<([\d]+),([\w\W]+)>/);
        const level = Number.parseInt(match[1]);
        const title = match[2];
        const link = p.titleId(title);
        p.opts.secs.push({ level, title });
        return `<span id="${link}"></span>`;
    }
);

/* mdref */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/#mdref<([\w\W]+)>/),

    (t, p) => {
        const match = t.match(/#mdref<([\w\W]+)>/);

        for (let i = 0; i < p.opts.secs.length; i++) {
            let { title } = p.opts.secs[i];
            if (title === match[1]) break;

            if (i === p.opts.secs.length - 1)
                throw new Error(
                    `Reference to [${match[1]}] could not be resolved!`
                );
        }

        match[1] = match[1].replace("_", " ");
        const link = p.titleId(match[1]);
        if (p.opts.targetType === TargetType.HTML)
            return `<a href="#${link}">${match[1]}</a>`;
        else if (p.opts.targetType === TargetType.MARKDOWN)
            return `[${match[1]}](#${link})`;
    }
);

new Command(
    CommandType.PARSE,
    (t, p) => t.match(/#mdtemplate<([\w\W]+)>/),
    (t, p) => {
        const match = t.match(/#mdtemplate<([\w\W]+)>/);
        const template = match[1];
        const replacement = templates[template];

        if (replacement !== undefined) {
            return replacement;
        } else {
            throw new Error(`Template \"${template}\" not found!`);
        }
    }
);

new Command(
    CommandType.POSTPARSE,
    (t, p) => t.match(/#mdmaketoc/),
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
