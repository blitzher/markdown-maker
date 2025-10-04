import path from "path";
import { MDMError, MDMNonParserError } from "../src/errors";
import util from "./_test-util";
import Colors from "colors.ts";

describe("Error handling", () => {
	it("should dissallow undefined templates", () => {
		util.put("#mdtemplate<UNDEF>", "sample1.md");

		const parser = new util.Parser("tests/test-files/sample1.md");

		let answer = "\n...on line 1 in tests/test-files/sample1.md".grey(15);

		util.expect(() => parser.get()).toThrow(MDMError);
	});
	it("should dissallow loading a folder without an entry file", () => {
		util.put("#mdinclude<sample_fld>", "sample1.md");
		util.putDir("sample_fld");

		function get() {
			const parser = new util.Parser("tests/test-files/sample1.md");
			util.standardizeFilepathSeparators(parser.get());
		}

		const os_appropriate_path = path.join(
			"tests",
			"test-files",
			"sample_fld",
			"sample_fld.md"
		);

		let answer =
			`No entry file found in folder "sample_fld". Looking for "${os_appropriate_path}"` +
			"\n...on line 1 in tests/test-files/sample1.md".grey(15);

		util.expect(get).toThrow(MDMError);
		util.expect(get).toThrow(answer);
	});
	it("should dissallow adding more than one hook with the same name", () => {
		const parser = new util.Parser("tests/test-files/sample1.md");

		parser.add_hook("test", () => {});
		util.expect(() => parser.add_hook("test", () => {})).toThrow(
			MDMNonParserError
		);
	});
	describe("Duplicate key errors", () => {
		it("should dissallow adding more than one template with the same name", () => {
			/*  */
			util.put(
				`module.exports = {main: (new_template, new_command) =>
					{
						new_template('test', 'hello');
						new_template('test', 'hello');
					}
				};`,
				"extensions.js"
			);

			util.put("", "sample1.md");

			function get() {
				const parser = new util.Parser("tests/test-files/sample1.md");
				parser.get();
			}

			util.expect(get).toThrow(MDMNonParserError);
			util.expect(get).toThrow('Template "test" already exists');
		});
	});
});
