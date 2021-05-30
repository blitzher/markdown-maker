const util = require("./tester.test.js");

describe("Target specific functionality", () => {

	describe("HTML", () => {
		it("Should include `#mdlabel` command, when compiling HTML", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>");
			const html = parser.get(util.TargetType.HTML);

			util.assert.strictEqual(html, '<span id="Cool!"></span>\n\n')

			const md = parser.get(1);
			util.assert.strictEqual(md, '\n\n')
		});
	});

	describe("Markdown", () => {
		it("Should not include `#mdlabel` command, when compiling Markdown", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>");

			const md = parser.get(util.TargetType.MARKDOWN);
			util.assert.strictEqual(md, '\n\n')
		})

	})
});