import * as path from "path";
import Parser from "./parser";
import * as fs from "fs";
import templates, { new_template } from "./templates";
import requireRuntime from "require-runtime";
import * as nodeHtmlParser from "node-html-parser";
import { HTMLElement } from "node-html-parser";
import crypto from "crypto";
import {
	CommandGroupType,
	CommandType,
	TaggedElement,
	TargetType,
} from "./types";
import { MDMError } from "./errors";

const salt = crypto.randomBytes(2).toString("hex");

export const commands: CommandGroupType = {
	preparse: [],
	parse: [],
	postparse: [],
};

export class Command {
	validator: RegExp;
	acter: (match: RegExpExecArray, parser: Parser) => string | void;
	type: CommandType;

	constructor(
		validator: RegExp,
		acter: (match: RegExpExecArray, parser: Parser) => string | void,
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

	act(match: RegExpExecArray, parser: Parser) {
		return this.acter(match, parser);
	}
}

/* variable shorthand */
new Command(
	/(\s|^)!<(.+)>/,
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
			throw new MDMError(`Undefined variable: ${match[1]}`, match);
		return (value = value || `<${match[1]}>`);
	},
	CommandType.PARSE
);

/** mdinclude */
new Command(
	/#mdinclude<([\w.\/-]+)(?:[,\s]+([\w]+))?>/,
	(match, parser) => {
		/* increment the current recursion depth */
		parser.opts.depth++;

		if (parser.opts.depth > parser.opts.max_depth) {
			throw new MDMError("max depth exceeded!", match);
		}

		/* get the matching group */
		let [_, name, condition] = match;

		/* implement conditional imports */
		if (condition && !parser.opts.args.includes(condition)) return;

		const fsstat = fs.lstatSync(path.join(parser.wd, name));
		if (fsstat.isDirectory()) {
			/* check if a file with the same name of the
			 * exists in the folder */

			const entry = path.join(parser.wd, name, `${name}.md`);
			if (fs.existsSync(entry)) {
				name = path.join(name, `${name}.md`);
			} else {
				throw new MDMError(
					`No entry file found in folder "${name}". Looking for "${entry}"`,
					match
				);
			}
		}

		const recursiveParser = parser.createChild(path.join(parser.wd, name));

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
					`Reference to [${match[1]}] could not be resolved!`,
					match
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
	(match, parser) => parser.get_toc(),
	CommandType.POSTPARSE
);

/* mdadvhook */
new Command(
	/\#mdhook<(\w+)>([\w\W]+)\#mdendhook<\1>/m,
	(match, parser) => {
		if (!parser.opts.hooks[match[1]])
			throw new MDMError(`No advanced hook found for ${match[1]}`, match);

		const innerElements = match[2].trim();

		/* Run the inner elements through the parser itself */
		const innerParser = parser.createChild(innerElements);

		/* parse the inner */
		let innerBlob = innerParser.get(parser.opts.targetType).trim();

		/* Find all tagged elements in inner */
		/* and construct helper map  */
		const re = /<(\w+)::(\w+)([\s=\w\"\'-]*)>/g;
		const map: { [key: string]: TaggedElement } = {};
		for (let match of innerBlob.matchAll(re)) {
			const args = Array.from(match[3].matchAll(/(\w+)=["'](.+?)["']/g));
			const argsMap = Object.fromEntries(args.map((x) => x.slice(1)));
			map[match[2]] = {
				"html-tag": match[1],
				"var-tag": match[2],
				node: new nodeHtmlParser.HTMLElement(match[1], {}),
				args: Object.fromEntries(
					match[3]
						.trim()
						.split(" ")
						.map((x) => x.split("="))
				),
				_raw: match[0],
			};
		}

		/* Replace tagged elements in inner blob with their uuids */
		for (let taggedElement of Object.values(map)) {
			innerBlob = innerBlob.replace(
				taggedElement._raw,
				salt + taggedElement["var-tag"] + salt
			);
		}

		/* Run the hook on the map*/
		parser.opts.hooks[match[1]](map);

		/* Replace the tagged elements with the modified nodes */
		let output = innerBlob;
		for (let taggedElement of Object.values(map)) {
			output = output.replace(
				salt + taggedElement["var-tag"] + salt,
				taggedElement.node.toString()
			);
		}

		return output;
	},
	CommandType.POSTPARSE
);

const loaded_extentions: fs.PathLike[] = [];

function load_extension(parser: Parser, file: fs.PathLike) {
	// if (loaded_extentions.includes(file)) return;
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
