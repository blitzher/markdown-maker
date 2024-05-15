import util from "./_test-util";
import assert from "assert";

describe("Use of markdown hooks for SSR", () => {
	it("should allow hooks hooks to be used", () => {
		util.put("#mdhook<t1>\n<var>\n#mdendhook<t1>", "sample1.md");

		const parser = new util.Parser("tests/test-files/sample1.md", {
			allow_undefined: true,
		});
		parser.add_adv_hook("t1", (map) => {
			map["var"].textContent = "complete";
		});

		const output = parser.get();

		assert.strictEqual(output, "<p>complete</p>\n\n");
	});

	it("should allow for extracting a node from the document as a template using map and data-tags", () => {
		util.put(
			`<html><body>#mdhook<template><name data-tag="b"></name><class data-tag="p"></class>#mdendhook<template></body></html>`,
			"sample1.html"
		);

		const parser = new util.Parser("tests/test-files/sample1.html", {
			allow_undefined: true,
		});

		parser.add_adv_hook("template", (map) => {
			map["name"].textContent = "bold";
			map["class"].textContent = "paragraph";
		});
		const output = parser.get();

		assert.strictEqual(
			output,
			"<html><body><b>bold</b><p>paragraph</p></body></html>\n\n"
		);
	});
	it("should allow for nested hooks to be used", () => {
		util.put(
			'#mdadvhook<t1><outer1 data-tag="p">#mdadvhook<t2><inner>#mdendhook<t2><outer2 data-tag="p">#mdendhook<t1>',
			"sample1.md"
		);

		const parser = new util.Parser("tests/test-files/sample1.md", {
			allow_undefined: true,
		});
		parser.add_adv_hook("t1", (map) => {
			map["outer1"].textContent = "hello";
			map["outer1"].textContent = "world";
		});
		parser.add_adv_hook("t2", (map) => {
			map["inner"].textContent = "!";
		});

		const output = parser.get();

		assert.strictEqual(output, "<p>hello</p><p>!</p><p>world</p>world\n\n");
	});
});
