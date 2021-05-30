import * as path from "path";
import { title } from "process";
import Parser from "./parse";

const commands = {
    preparse: [],
    parse: [],
    postparse: [],
};

const CommandType = {
    PREPARSE: 0,
    PARSE: 1,
    POSTPARSE: 2,
};

enum TargetType {
    HTML,
    MARKDOWN,
}

class Command {
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
    (t, p) => t.match(/(?:\s|^)<\w+>/),
    (t, p) => `#mdvar` + t
);

/* mddef */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/^#mddef<(\w+)=(\w+)>/),
    (t, p) => {
        const m = t.match(/^#mddef<(\w+)=(\w+)>/);
        p.opts.defs[m[1]] = m[2];
    }
);

/* mdvar */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/^#mdvar<(\w+)>/) || t.match(/^<(\w+)>/),
    (t, p) => {
        const match = t.match(/#mdvar<(\w+)>/);
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
    (t, p) => t.match(/^#mdinclude<([\w.\/-]+)>/),
    (t, p) => {
        const Parser = require("./parse");
        /* increase the current recursive depth */
        p.opts.depth++;

        if (p.opts.depth > p.opts.max_depth) {
            throw new Error("max depth exceeded!");
        }

        /* get the matching group */
        const name = t.match(/^#mdinclude<([\w.\/-]+)>/)[1];
        const recursiveParser = new Parser(path.join(p.wd, name), p.opts, p);

        /* keep the options the same */
        recursiveParser.opts = p.opts;
        recursiveParser.parent = p;

        const _fileNameArr = recursiveParser.file.split(".");
        const fileType = _fileNameArr[_fileNameArr.length - 1];

        const blob =
            fileType === "md" ? recursiveParser.get() : recursiveParser.raw;

        p.opts.depth--;
        return blob;
    }
);

/* convert #mdmaketoc into postparse task */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/#mdmaketoc/),
    (t, p) => "POSTTASK:TOC"
);

new Command(
    CommandType.PREPARSE,
    (t, p) => t.match(/#mdlabel<(\d+),([\w\W]+)>/),
    (t, p) => {
        if (p.opts.targetType !== TargetType.HTML) return;

        const match = t.match(/#mdlabel<([\d]+),([\w\W]+)>/);
        const level = Number.parseInt(match[1]);
        const title = match[2];
        const link = p.titleId(title);
        p.opts.secs.push({ level, title });
        return `<span id="${link}"></span>`;
    }
);

new Command(
    CommandType.PARSE,
    (t, p) => t.match(/#mdref<([\w\W]+)>/),
    
    (t, p) => {
        const match = t.match(/#mdref<([\w\W]+)>/);
        
        for (let i = 0; i < p.opts.secs.length; i++) {
            
            let {title} = p.opts.secs[i];
            if (title === match[1]) 
            break;
            
            if (i === p.opts.secs.length - 1) 
            throw new Error(`Reference to [${match[1]}] could not be resolved!`)
        }
        
        match[1] = match[1].replace("_", " ");
        const link = p.titleId(match[1]);
        if (p.opts.targetType === TargetType.HTML)
            return `<a href="#${link}">${match[1]}</a>`;
        else if (p.opts.targetType === TargetType.MARKDOWN)
            return `[${match[1]}](#${link})`
        
    }
)

new Command(
    CommandType.POSTPARSE,
    (t, p) => t.match("(s|^)POSTTASK:TOC"),
    (t, p) => p.gen_toc()
);

module.exports = commands;
