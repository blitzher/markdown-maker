const path = require("path");

const commands = {
    preparse : [],
    parse : [],
    postparse : []
};

const CommandType = {
    PREPARSE : 0,
    PARSE : 1,
    POSTPARSE : 2
}

class Command {

    constructor(type, validator, acter) {
        this.type = type;
        this.validator = validator;
        this.acter = acter;

        /* add this function to appropriate file */
        switch (type) {
            case CommandType.PARSE:
                commands.parse.push(this); break;
            case CommandType.PREPARSE:
                commands.preparse.push(this); break;
            case CommandType.POSTPARSE:
                commands.postparse.push(this); break;    
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
    (t, p) => `#mdvar` + t,
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
        const value = p.opts.defs[match[1]] || `<UDEF=${match[1]}>`;
        return t.replace(match[0], value.replace("_", " "));
    },
);

/** mdinclude */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/^#mdinclude<([\w.\/-]+)>/),
    (t, p) => {

        const Parser = require("./parse");
        /* increase the current recursive depth */
        p.opts.depth ++;

        if (p.opts.depth > p.opts.max_depth) {
            throw new Error("max depth exceeded!");
        }

        /* get the matching group */
        const name = t.match(/^#mdinclude<([\w.\/-]+)>/)[1];
        const recursiveParser = new Parser(path.join(p.wd, name), p.opts, p);

        /* keep the options the same */
        recursiveParser.opts = p.opts;
        recursiveParser.parent = p;

        const blob = recursiveParser.get();
        p.opts.depth --;
        return blob;
    }
);

/* convert #mdmaketoc into postparse task */
new Command(
    CommandType.PARSE,
    (t, p) => t.match(/#mdmaketoc/),
    (t, p) => "POSTTASK:TOC",
);

new Command(
    CommandType.POSTPARSE,
    (t, p) => t.match("(\s|^)POSTTASK:TOC"),
    (t, p) => p.gen_toc(),
);

/* mdvar */
module.exports = commands;

