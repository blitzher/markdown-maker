const util = require("./tester.test.js");

describe("Use of markdown hooks for SSR", () => {
    it("should allow a simple hook to be used", () => {
        util.put("#mdhook<test>", "sample1.md");

        const parser = new util.Parser("test/test-files/sample1.md");
        parser.add_hook("test", () => "hello");
        const output = parser.get();

        util.assert.strictEqual(output, "hello\n\n");
    });
    it("should allow advanced hooks to be used", () => {
        util.put(
            "#mdadvhook<test>\n<b>Bold</b>\n<p>Paragraph</p>\n#mdendhook",
            "sample1.md"
        );

        const replacer = (arg) => {
            const elem = new util.html.HTMLElement("p", {});
            elem.set_content("complete");
            return elem;
        };

        const parser = new util.Parser("test/test-files/sample1.md");
        parser.opts.allow_undefined = true;
        parser.add_adv_hook("test", replacer);
        const output = parser.get();

        util.assert.strictEqual(output, "<p>complete</p>\n\n");
    });
    it("should allow for hooks to be used in HTML", () => {
        util.put("<html><body>#mdhook<test></body></html>", "sample1.html");

        const parser = new util.Parser("test/test-files/sample1.html");
        parser.opts.allow_undefined = true;
        parser.add_hook("test", () => "hello");
        const output = parser.get();

        util.assert.strictEqual(output, "<html><body>hello</body></html>\n\n");
    });
    it("should allow for hooks to be used in HTML with advanced hooks", () => {
        util.put(
            "<html><body>#mdadvhook<test>\n<b>Bold</b>\n<p>Paragraph</p>\n#mdendhook</body></html>",
            "sample1.html"
        );

        const replacer = (arg) => {
            const elem = new util.html.HTMLElement("p", {});
            elem.set_content("complete");
            return elem;
        };

        const parser = new util.Parser("test/test-files/sample1.html");
        parser.opts.allow_undefined = true;
        parser.add_adv_hook("test", replacer);
        const output = parser.get();

        util.assert.strictEqual(
            output,
            "<html><body><p>complete</p></body></html>\n\n"
        );
    });
    it("should allow for extracting a node from the document as a template manually with ids", () => {
        util.put(
            `<html><body>#mdadvhook<template><name id="b"></name><class id="p"></class>#mdendhook</body></html>`,
            "sample1.html"
        );

        const replacer = (elem) => {
            const nameElem = elem.getElementsByTagName("name")[0];
            nameElem.tagName = nameElem.id;
            nameElem.removeAttribute("id");
            nameElem.set_content("bold");
            const classElem = elem.getElementsByTagName("class")[0];
            classElem.tagName = classElem.id;
            classElem.removeAttribute("id");
            classElem.set_content("paragraph");
            return elem;
        };

        const parser = new util.Parser("test/test-files/sample1.html");
        parser.opts.allow_undefined = true;
        parser.add_adv_hook("template", replacer);
        const output = parser.get();

        util.assert.strictEqual(
            output,
            "<html><body><b>bold</b><p>paragraph</p></body></html>\n\n"
        );
    });
    it("should allow for extracting a node from the document as a template using map and data-tags", () => {
        util.put(
            `<html><body>#mdadvhook<template><name data-tag="b"></name><class data-tag="p"></class>#mdendhook</body></html>`,
            "sample1.html"
        );

        const replacer = (elem, map) => {
            map["name"].set_content("bold");
            map["class"].set_content("paragraph");
            return elem;
        };

        const parser = new util.Parser("test/test-files/sample1.html");
        parser.opts.allow_undefined = true;
        parser.add_adv_hook("template", replacer);
        const output = parser.get();

        util.assert.strictEqual(
            output,
            "<html><body><b>bold</b><p>paragraph</p></body></html>\n\n"
        );
    });
});
