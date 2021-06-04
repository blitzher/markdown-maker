const util = require("./tester.test.js");

describe("Target specific functionality", () => {

	describe("HTML", () => {
		it("Should include `#mdlabel` command, when compiling HTML", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>");
			const html = parser.get(util.TargetType.HTML);

			util.assert.strictEqual(html, '<span id="cool"></span>\n\n')
		});

		it("Should link to sections with #mdref", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>\n#mdlabel<1,coolzz>\n#mdref<Cool!>");
			const html = parser.get(util.TargetType.HTML);

			util.assert.strictEqual(html, '<span id="cool"></span>\n<span id="coolzz"></span>\n<a href="#cool">Cool!</a>\n\n');
		})
	});

	describe("Markdown", () => {
		it("Should not include `#mdlabel` command, when compiling Markdown", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>");

			const md = parser.get(util.TargetType.MARKDOWN);
			util.assert.strictEqual(md, '\n\n')
		});
		it("Should include #mdref to title elements in markdown", () => {
			const parser = new util.Parser("# Some Title!\n#mdref<Some_Title!>");

			const md = parser.get(util.TargetType.MARKDOWN);

			util.assert.strictEqual(md, '# Some Title!\n[Some Title!](#some-title)\n\n')
		});

	})
});