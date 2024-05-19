import fs from "fs"; /* for handling reading of files */
import path from "path"; /* for handling file paths */

import marked from "marked";

import { Command, commands, load_extensions } from "./commands";
import {
	argParser,
	IncompleteCommandLineArgs,
	IncompleteParserOptions,
	ParserOptions,
} from "./cltool";
import { MDMError, MDMNonParserError, MDMWarning } from "./errors";
import { CommandGroupType, TaggedElement, TargetType } from "./types";

/* parse some md
 * recursively with extra options */
class Parser {
	file: string;
	parent?: Parser;
	line_num: number;
	wd: string;
	wd_full: string;
	blobs: {
		[key: number]: string | undefined;
	};
	opts: ParserOptions;
	raw: string;

	static TOKEN = "#md";

	constructor(
		filename: string,
		clargs?: IncompleteCommandLineArgs,
		opts?: IncompleteParserOptions
	) {
		/* this.working_directory */
		this.file = filename;

		this.line_num = 0;
		this.wd = path.dirname(filename);
		this.wd_full = path.resolve(this.wd);

		/* finished blob */
		this.blobs = {};

		if (!clargs) {
			clargs = argParser.parse_args([filename]);
		}

		/* get default options, and overwrite with the ones present
           in the arguments */
		this.opts = defaultParserOptions();
		Object.assign(this.opts, clargs);
		Object.assign(this.opts, opts);

		this.raw = this.opts.isFileCallback(filename) || filename;
	}

	private parse() {
		load_extensions(this);
		if (this.opts.verbose || this.opts.debug) {
			console.log(
				`parsing ${this.file}: depth=${this.opts.depth}`.magenta
			);
		}

		if (this.opts.debug) {
			console.log("Parsing options:");
			console.log(this.opts);
		}

		/* reset sections for beginning parse */
		if (this.opts.depth === 0) this.opts.secs = [];
		let __blob = this.raw;

		/* apply preproccessing to raw file */
		__blob = this.preprocess(__blob);

		/* main parser instance call */
		__blob = this.mainparse(__blob);

		/**
		 * apply postprocessing after */
		__blob = this.postprocess(__blob);

		return __blob;
	}

	private mainparse(blob: string) {
		if (this.opts.verbose || this.opts.debug) {
			console.debug(`beginning mainparse of '${this.file}'`.blue);
		}

		/* main parser instance loop */
		blob.split("\n").forEach((line, lnum) => {
			this.line_num = lnum;

			/* if line looks like a title */
			const titleMatch = line.trim().match(/^(#+) (.+)$/);

			if (titleMatch) {
				if (this.opts.verbose || this.opts.debug)
					console.log("found toc element: " + line);

				/* implement toc level */
				let level = titleMatch[1].length;
				let title = titleMatch[2];

				this.opts.secs.push({ level, title });

				if (this.opts.debug) {
					console.log("updated sections:", { level, title });
				}
			}
		});

		return this.parse_commands(blob, commands.parse);
	}

	private preprocess(blob: string) {
		if (this.opts.verbose || this.opts.debug) {
			console.debug(`beginning preprocess of '${this.file}'`.blue);
		}

		return this.parse_commands(blob, commands.preparse);
	}

	private postprocess(blob: string) {
		if (this.opts.verbose || this.opts.debug) {
			console.debug(`beginning postprocess of '${this.file}'`.blue);
		}

		blob = this.parse_commands(blob, commands.postparse);

		/* remove double empty lines */
		blob = this.remove_double_blank_lines(blob);
		blob = blob.trimEnd() + "\n\n";
		return blob;
	}

	private parse_commands(blob: string, commands: Command[]) {
		commands.forEach((command) => {
			/* Add global flag to RegExp */
			const re = new RegExp(
				command.validator.source,
				(command.validator.flags || "") + "g"
			);

			const replacer = (args: RegExpExecArray) => {
				try {
					return command.act(args, this) || "";
				} catch (error) {
					switch (true) {
						case error instanceof MDMError:
							throw error;
						case error instanceof MDMWarning:
							console.warn(error.message);
							return `**Warning: ${error.message}**`;
						default:
							console.error(error);
							throw error;
					}
				}
			};

			/*  */

			let match: RegExpExecArray | null;
			while ((match = re.exec(blob)) !== null) {
				blob =
					blob.slice(0, match.index) +
					replacer(match) +
					blob.slice(match.index + match[0].length);
			}
		});
		return blob;
	}

	/* Parse all commands sequentially on a sub-blob */
	private parse_all_commands(blob: string, commands: CommandGroupType) {
		blob = this.parse_commands(blob, commands.preparse);
		blob = this.parse_commands(blob, commands.parse);
		blob = this.parse_commands(blob, commands.postparse);
		return blob;
	}

	titleId(title: string) {
		const sep = this.opts.use_underscore ? "_" : "-";

		title = title
			.toLowerCase()
			.replace(/[^\w\s]+/g, "")
			.replace(/[\s_]+/g, sep);
		return title;
	}

	get_toc() {
		let __blob = [];
		let tabSize = 2;
		const beg = "* ";
		const hor = " ".repeat(tabSize);

		this.opts.secs.forEach((sec) => {
			if (sec.level > this.opts.toc_level) return;
			let title = sec.title.replace(/_/g, " ");
			title = this.parse_all_commands(title, commands);
			const link = this.titleId(title);

			let __line =
				hor.repeat(Math.max(sec.level - 1, 0)) +
				beg +
				`[${title}](#${link})`;

			__blob.push(__line);
		});
		return __blob.join("\n");
	}

	add_hook(
		name: string,
		hook: (map: { [key: string]: TaggedElement }) => void
	) {
		if (this.opts.hooks[name] != undefined)
			throw new MDMNonParserError(`Hook "${name}" already exists!`);
		this.opts.hooks[name] = hook;
	}

	private line_num_from_index(index: number) {
		return this.raw.substring(0, index).split("\n").length;
	}

	private remove_double_blank_lines(blob) {
		/* replace all triple newlines, and EOF by double newline */
		blob = blob.replace(/(\r\n|\n){3,}/g, "\n\n");

		return blob;
	}

	/* output the parsed document to bundle */
	to(bundleName: string, callback: (fileName: string) => void) {
		const dir = path.dirname(bundleName);
		if (callback === undefined) callback = () => {};

		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		if (!this.opts.html) {
			this.get(TargetType.MARKDOWN, (blob) => {
				fs.writeFile(bundleName, blob, () => callback(bundleName));
			});
		} else {
			const htmlFileName = bundleName.replace(".md", ".html");
			fs.writeFile(htmlFileName, this.html(), () =>
				callback(htmlFileName)
			);
		}
	}

	html() {
		const htmlFormatted = marked
			.parse(this.get(TargetType.HTML))
			.toString();
		if (this.opts.watch) {
			return (
				`<script>` +
				`w=new WebSocket("ws:localhost:7788");` +
				`w.addEventListener("message",(e)=>` +
				`   {if(e.data=="refresh")location.reload();}` +
				`);` +
				`</script>\n` +
				htmlFormatted
			);
		}
		return htmlFormatted;
	}

	createChild(file: string) {
		return new Parser(file, undefined, {
			parent: this,
			depth: this.opts.depth + 1,
			...this.opts,
		});
	}

	get(targetType?: TargetType, callback?: (blob: string) => void): string {
		/* If target type is undefined, markdown is the default */
		if (targetType === undefined) targetType = TargetType.MARKDOWN;
		if (this.blobs[targetType]) {
			if (callback) {
				callback(this.blobs[targetType]);
			}
			return this.blobs[targetType];
		} else {
			try {
				this.opts.targetType = targetType;
				let blob = this.parse();
				this.opts.targetType = undefined;
				if (callback) callback(blob);
				return blob;
			} catch (error) {
				/* Compile a traceback of error */
				let traceback = "";
				let p: Parser = this;

				do {
					if (error instanceof MDMError)
						traceback += `\n...on line ${p.line_num_from_index(
							error.match.index
						)} in ${p.file}`.grey(15);
					else
						traceback +=
							`\n...on line ${p.line_num} in ${p.file}`.grey(15);
					if (p.parent) p = p.parent;
				} while (p.parent);

				error.message += traceback;

				/* only interested in node stacktrace when debugging */
				if (!this.opts.debug) error.stack = "";

				if (this.opts.only_warn) console.error(error);
				else throw error;
			}
		}
	}
}

function defaultParserOptions(): ParserOptions {
	return {
		defs: {},
		secs: [],
		args: [],
		depth: 0,
		verbose: false,
		debug: false,
		max_depth: 5,
		use_underscore: false,
		toc_level: 3,
		allow_undefined: false,
		html: false,
		watch: false,
		targetType: undefined,
		only_warn: false,
		parent: undefined,
		hooks: {},
		isFileCallback: (f) => {
			if (!fs.existsSync(f)) return false;
			return fs.readFileSync(f, "utf-8") + "\n";
		},
	};
}

export function splice(
	str: string,
	startIndex: number,
	width: number,
	newSubStr: string
) {
	const start = str.slice(0, startIndex);
	const end = str.slice(startIndex + width);
	return start + newSubStr + end;
}

/* add extention to marked for classed blockquotes*/
marked.use({
	renderer: {
		blockquote(quote: string) {
			/* find the ending, and if not, return the default */
			const ending = quote.match(/\{(.+)\}\s*<\/p>/);
			if (!ending) return `<blockquote>${quote}</blockquote>`;

			const args = ending[1].split(" ");

			const classes = args.filter((arg) => arg.startsWith("."));
			const id = args.filter((arg) => arg.startsWith("#"));

			const classNames = classes.map((c) => c.slice(1));
			const classText =
				classes.length > 0 ? `class="${classNames.join(" ")}"` : "";
			const idText = id.length > 0 ? `id="${id[0].slice(1)}"` : "";

			/* remove the ending from the quote */
			quote = quote.replace(/\{(.+)\}\s*<\/p>/, "</p>");

			return `<blockquote ${classText} ${idText}>\n${quote.trim()}</blockquote>`;
		},
		heading(text: string, level: number) {
			/* add an id to each heading */
			return `<h${level} id="${text
				.replace(/ /g, "-")
				.toLowerCase()}">${text}</h${level}>`;
		},
	},
});

export default Parser;
