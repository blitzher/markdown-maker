import assert from "assert";
import util from "./_test-util";
import { MDMError } from "../src/commands";

describe("Basic features", () => {
	it("should join two files with include", () => {
		util.put("hello\n#mdinclude<sample2.md>", "sample1.md");
		util.put("there", "sample2.md");

		const parser = new util.Parser("tests/test-files/sample1.md");
		const output = parser.get();

		assert.strictEqual(output, "hello\nthere\n\n");

		assert.strictEqual(output, "hello\nthere\n\n");
	});
	it("should make a table of contents", () => {
		const output = new util.Parser(
			"# yo\n## bruh nugget\n#mdmaketoc"
		).get();

		assert.strictEqual(
			output,
			"# yo\n## bruh nugget\n* [yo](#yo)\n  * [bruh nugget](#bruh-nugget)\n\n"
		);
	});
	it("should allow quotation marks in titles for toc", () => {
		const parser = new util.Parser("# mac's farm\n#mdmaketoc");
		const markdown = parser.get();

		assert.strictEqual(
			markdown,
			"# mac's farm\n* [mac's farm](#macs-farm)\n\n"
		);
	});
	it("should allow variables in toc", () => {
		const output = new util.Parser(
			"#mddef<name= Foobar>\n# mr. #mdvar<name>\n#mdmaketoc<>"
		).get();

		assert.strictEqual(
			output,
			"\n# mr. Foobar\n* [mr. Foobar](#mr-foobar)\n\n"
		);
	});
	it("should not exceed max include depth", () => {
		util.put("#mdinclude<sample2.md>", "sample1.md");
		util.put("yo.md>", "sample2.md");

		assert.throws(() => {
			const parser = new util.Parser("tests/test-files/sample1.md", {
				max_depth: 0,
			});
			parser.get();
		}, MDMError);
	});
	it("should be able to reference toc elements, even if they are below toc-level", () => {
		const parser = new util.Parser(`### Title\n#mdref<Title>`);

		assert.strictEqual(parser.get(), "### Title\n[Title](#title)\n\n");
	});
	it("should include file with same name as folder when including a folder", () => {
		util.put("#mdinclude<sample_fld>", "sample1.md");
		util.putDir("sample_fld");
		util.put("hello", util.path.join("sample_fld", "sample_fld.md"));

		const parser = new util.Parser("tests/test-files/sample1.md");
		const output = parser.get();

		assert.strictEqual(output, "hello\n\n");
	});
});
