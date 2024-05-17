import path from "path";
import { WebSocketServer } from "ws";
import * as fs from "fs";

import choki from "chokidar";
import Parser from "./parser";

/* for adding colours to strings */
import { enable as ColorsEnable } from "colors.ts";
ColorsEnable();

import { argParser, CommandLineArgs, ParserOptions } from "./cltool";
const configFileName = ".mdmconfig.json";

function main() {
	let clargs: CommandLineArgs;
	let server: WebSocketServer | undefined;

	/* Read config file or parse args from cmd-line */
	if (fs.existsSync(configFileName)) {
		let data: CommandLineArgs = JSON.parse(
			fs.readFileSync(configFileName).toString()
		).opts;

		let args: (string | number)[] = [];
		Object.entries(data).forEach(([key, value]) => {
			if (key != "src" && value !== false) {
				args.push("--" + key);
			}
			if (typeof value != "boolean") {
				args.push(value);
			}
		});

		/* We skip [0] and [1], as  it is the binary and source file, even when compiled*/
		for (let i = 2; i < process.argv.length; i++)
			args.push(process.argv[i]);

		clargs = argParser.parse_args(args.map((x) => x.toString()));
	} else {
		clargs = argParser.parse_args();
	}

	/* if src is init, create config file and exit */
	if (clargs.src == "init") {
		const template = fs.readFileSync(
			path.join(
				__dirname,
				"..",
				"src",
				"templates",
				"configTemplate.json"
			)
		);
		fs.writeFileSync(configFileName, template);
		fs.writeFileSync("main.md", "# Main\n");
		return;
	}

	/* helper method for calling parser */
	const compile = (source, output, cb?) => {
		/* load data from file, if it exists,
		 * otherwise, interpret as string */

		const parser = new Parser(source, clargs);
		parser.to(output, (file) => {
			console.log(`Compiled ${file}`.green);
			if (cb) cb();
		});
		return parser;
	};

	const internalCooldown = 1000;
	function watcher(_, path: string) {
		const now = Date.now();

		if (!this.time) this.time = now;
		if (now - this.time < internalCooldown) return;
		console.log(`Detected change in ${path}...`);
		try {
			compile(clargs.src, clargs.output, () => {
				/* after compile, send refresh command to clients */
				server.clients.forEach((client) => {
					if (client.OPEN) client.send("refresh");
				});
			});
		} catch (e) {
			console.log(e.message);
		}

		this.time = now;
	}

	/* in case source is a directory, look for entry in directory */
	if (fs.existsSync(clargs.src) && fs.lstatSync(clargs.src).isDirectory()) {
		clargs.src = path.join(clargs.src, clargs.entry);
	}

	if (clargs.debug) console.dir(clargs);

	/* compile once if not watching 
       otherwise watch the folder and recompile on change */
	if (!clargs.watch) compile(clargs.src, clargs.output);
	else {
		const srcDirName = path.dirname(clargs.src);
		console.log(`Watching ${srcDirName} for changes...`.yellow);
		server = new WebSocketServer({ port: 7788 });

		const _watcher = choki.watch(srcDirName).on("all", watcher);
		try {
			compile(clargs.src, clargs.output);
		} catch (e) {
			console.log(e.message);
		}
	}
}
export default {
	Parser,
};
/* main entrypoint */
if (require.main === module) {
	main();
}
