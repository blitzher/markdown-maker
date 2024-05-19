import fs from "fs"; /* for handling reading of files */
import path from "path"; /* for handling file paths */

import Colors = require("colors.ts"); /* for adding colours to strings */
import { TaggedElement, TargetType } from "./types";
import Parser from "./parser";

const version = process.env.npm_package_version || "0.0.0";

Colors.enable();
import { ArgumentParser } from "argparse"; /* for parsing clargs */
import { HTMLElement } from "node-html-parser";

export const argParser = new ArgumentParser({
	description:
		"Markdown bundler, with extra options. Extension file is loaded from ./extensions.js, if it exists",
	prog: "mdparse",
});

//#region command line args
argParser.add_argument("src", {
	help: "file to be parsed. If this is a directory, it looks for entry point in the directory, see --entry",
});
argParser.add_argument("--version", {
	action: "version",
	version: `v${version}`,
});
argParser.add_argument("-v", "--verbose", {
	action: "store_true",
	help: "enable verbose output",
});
argParser.add_argument("-D", "--debug", {
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
	default: "main.md",
});
argParser.add_argument("-w", "--watch", {
	action: "store_true",
	help: "recompile after a change in target target file or directory.",
});
argParser.add_argument("-u", "--use-underscore", {
	action: "store_true",
	help: "set the parser to use '_' as seperator in ids for Table of Content. If the links in the table does not work, this is likely to be the issue.",
});
argParser.add_argument("-t", "--toc-level", {
	help: "the section level of the table of contents, by default is 3",
	default: 3,
	type: "int",
});
argParser.add_argument("-H", "--html", {
	action: "store_true",
	help: "compile HTML from the parsed markdown",
});
argParser.add_argument("--allow-undefined", "-A", {
	action: "store_true",
	help: "allow the use of the \"<thing>\" syntax, without raising an error when 'thing' is not a variable. Mostly useful when writing inline html tags, and other non-strictly markdown related uses",
});
//#endregion

export type CommandLineArgs = {
	src: string;
	output: string;
	verbose: boolean;
	debug: boolean;
	max_depth: number;
	entry: string;
	watch: boolean;
	use_underscore: boolean;
	toc_level: number;
	html: boolean;
	allow_undefined: boolean;
};

export type IncompleteCommandLineArgs = {
	src?: string;
	output?: string;
	verbose?: boolean;
	debug?: boolean;
	max_depth?: number;
	entry?: string;
	watch?: boolean;
	use_underscore?: boolean;
	toc_level?: number;
	html?: boolean;
	allow_undefined?: boolean;
};

export type ParserOptions = {
	defs: {
		[key: string]: string;
	};
	secs: {
		level: number;
		title: string;
	}[];
	args: string[];
	depth: number;
	verbose: boolean;
	debug: boolean;
	max_depth: number;
	use_underscore: boolean;
	toc_level: number;
	allow_undefined: boolean;
	html: boolean;
	watch: boolean;
	targetType: TargetType | undefined;
	only_warn: boolean;
	parent?: Parser;
	hooks: {
		[key: string]: (map: { [tag: string]: TaggedElement }) => void;
	};
	isFileCallback: (s: string) => false | string;
};

export type IncompleteParserOptions = {
	defs?: {
		[key: string]: string;
	};
	secs?: {
		level: number;
		title: string;
	}[];
	args?: string[];
	depth?: number;
	verbose?: boolean;
	debug?: boolean;
	max_depth?: number;
	use_underscore?: boolean;
	toc_level?: number;
	allow_undefined?: boolean;
	html?: boolean;
	watch?: boolean;
	targetType?: TargetType | undefined;
	only_warn?: boolean;
	parent?: Parser;
	hooks?: {
		[key: string]: (map: { [tag: string]: TaggedElement }) => void;
	};
	isFileCallback?: (s: string) => false | string;
};
