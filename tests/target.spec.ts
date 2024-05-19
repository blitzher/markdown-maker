import util from "./_test-util";

describe("Target specific functionality", () => {
	describe("HTML", () => {
		it("Should include `#mdlabel` command, when compiling HTML", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>");
			const html = parser.get(util.TargetType.HTML);

			util.expect(html).toBe('<span id="cool"></span>\n\n');
		});

		it("Should link to sections with #mdref", () => {
			const parser = new util.Parser(
				"#mdlabel<0,Cool!>\n#mdlabel<1,coolzz>\n#mdref<Cool!>"
			);
			const html = parser.get(util.TargetType.HTML);

			util.expect(html).toBe(
				'<span id="cool"></span>\n<span id="coolzz"></span>\n<a href="#cool">Cool!</a>\n\n'
			);
		});
	});

	describe("Markdown", () => {
		it("Should not include `#mdlabel` command, when compiling Markdown", () => {
			const parser = new util.Parser("#mdlabel<0,Cool!>");

			const md = parser.get(util.TargetType.MARKDOWN);
			util.expect(md).toBe("\n\n");
		});
		it("Should include #mdref to title elements in markdown", () => {
			const output = new util.Parser(
				"# Some Title!\n#mdref<Some Title!>"
			).get();

			util.expect(output).toBe(
				"# Some Title!\n[Some Title!](#some-title)\n\n"
			);
		});
	});
});
