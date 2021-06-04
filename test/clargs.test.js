const util = require("./tester.test.js");

describe("Command Line Arguments", () => {
	it("--use-underscore should replace '-' with '_' in toc", () => {
		const output = new util.Parser("# foo bar\n#mdmaketoc",
			{ 'use_underscore': true }).get();

		util.assert.strictEqual(output, "# foo bar\n* [foo bar](#foo_bar)\n\n");
	});
	it("--toc-level should exclude subsection with lower level", () => {
		const output = new util.Parser("# foo bar\n### baz\n#mdmaketoc",
			{ 'toc_level': 2 }).get();

		util.assert.strictEqual(output, "# foo bar\n### baz\n* [foo bar](#foo-bar)\n\n")
	});
	it("--allow-undef should not throw when variable is not defined", () => {
		const output = new util.Parser("#mdvar<zum>", { 'allow_undef': true }).get();

		util.assert.strictEqual(output, "<zum>\n\n");

	});
});