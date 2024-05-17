import util from "./_test-util";
import assert from "assert";

describe("Use of markdown hooks for SSR", () => {
	it("should allow hooks hooks to be used", () => {
		util.put("#mdhook<t1>\n<p::var>\n#mdendhook<t1>", "sample1.md");

		const parser = new util.Parser("tests/test-files/sample1.md", {
			allow_undefined: true,
		});
		parser.add_hook("t1", (map) => {
			map["var"].node.textContent = "complete";
		});

		const output = parser.get();

		assert.strictEqual(output, "<p>complete</p>\n\n");
	});

	it("should allow for extracting a node from the document as a template using map and data-tags", () => {
		util.put(
			`<html><body>#mdhook<template><b::name><p::class>#mdendhook<template></body></html>`,
			"sample1.html"
		);

		const parser = new util.Parser("tests/test-files/sample1.html", {
			allow_undefined: true,
		});

		parser.add_hook("template", (map) => {
			map["name"].node.textContent = "bold";
			map["class"].node.textContent = "paragraph";
		});
		const output = parser.get();

		assert.strictEqual(
			output,
			"<html><body><b>bold</b><p>paragraph</p></body></html>\n\n"
		);
	});
	it("should allow for nested hooks to be used", () => {
		util.put(
			"#mdhook<t1><p::outer1>#mdhook<t2><p::inner>#mdendhook<t2><p::outer2>#mdendhook<t1>",
			"sample1.md"
		);

		const parser = new util.Parser("tests/test-files/sample1.md", {});
		parser.add_hook("t1", (map) => {
			map["outer1"].node.textContent = "hello";
			map["outer2"].node.textContent = "world";
		});
		parser.add_hook("t2", (map) => {
			map["inner"].node.textContent = "!";
		});

		const output = parser.get();

		assert.strictEqual(output, "<p>hello</p><p>!</p><p>world</p>\n\n");
	});
});
