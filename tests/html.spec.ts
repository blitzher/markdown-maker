import util from "./_test-util";
import assert from "assert";

describe("HTML Emitting", () => {
	it("should generate valid html", () => {
		const parser = new util.Parser("# cool title\nwith a cool paragraph");
		parser.opts.html = true;

		const output = parser.html();

		assert.strictEqual(
			output,
			'<h1 id="cool-title">cool title</h1><p>with a cool paragraph</p>\n'
		);
	});
	it("should be able to include html documents, and not parse", () => {
		util.put("#mdinclude<sample2.html>", "sample1.md");
		util.put("#mdvar<lul>", "sample2.html");

		const parser = new util.Parser("tests/test-files/sample1.md");
		const output = parser.get();

		assert.strictEqual(output, "#mdvar<lul>\n\n");
	});
});
