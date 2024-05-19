import { MDMError } from "../src/errors";
import util from "./_test-util";

describe("Use variables", () => {
	it("should replace var with the value", () => {
		const output = new util.Parser("#mddef<hi=yo>\n#mdvar<hi>").get();

		util.expect(output).toBe("\nyo\n\n");
	});
	it("should use variable shorthand", () => {
		const output = new util.Parser("#mddef<hi=yo>\n!<hi>").get();

		util.expect(output).toBe("\nyo\n\n");
	});
	it("should use variables across files", () => {
		util.put("#mddef<hi=yo>\n#mdinclude<sample2.md>", "sample1.md");
		util.put("!<hi>", "sample2.md");

		const output = new util.Parser("tests/test-files/sample1.md").get();

		util.expect(output).toBe("\nyo\n\n");
	});
	it("should throw if undefined variable", () => {
		const parser = new util.Parser("!<yo>");

		/* should throw an error */
		function get() {
			parser.get();
		}
		util.expect(get).toThrow();
	});

	it("should preserve whatever comes after", () => {
		const output = new util.Parser("#mddef<hi=yo>\n!<hi>,").get();
		util.expect(output).toBe("\nyo,\n\n");
	});

	it("should replace underscore with space", () => {
		const output = new util.Parser(
			"#mddef<name=Mr_Sir>\n#mdvar<name>"
		).get();

		util.expect(output).toBe("\nMr Sir\n\n");
	});
});
