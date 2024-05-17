import { MDMError } from "../src/commands";
import util from "./_test-util";
import assert from "assert";

describe("Error handling", () => {
	it("should dissallow undefined templates", () => {
		util.put("#mdtemplate<UNDEF>", "sample1.md");

		const parser = new util.Parser("tests/test-files/sample1.md");

		let answer =
			'Template "UNDEF" not found!' +
			"\n...on line 1 in tests/test-files/sample1.md".grey(15);

		assert.throws(
			() => parser.get(),
			(error: MDMError) => {
				return error.message == answer;
			}
		);
	});
	it("should dissallow loading a folder without an entry file", () => {
		util.put("#mdinclude<sample_fld>", "sample1.md");
		util.putDir("sample_fld");

		const parser = new util.Parser("tests/test-files/sample1.md");

		let answer =
			'No entry file found in folder "sample_fld". Looking for "sample_fld.md"' +
			"\n...on line 1 in tests/test-files/sample1.md".grey(15);

		assert.throws(
			() => parser.get(),
			(error: MDMError) => {
				return error.message == answer;
			}
		);
	});
});
