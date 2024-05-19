import util from "./_test-util";

describe("Marked extentions", () => {
	it("should add a single class to blockquotes", () => {
		const parser = new util.Parser("> hello {.one}", {
			use_underscore: true,
			html: true,
		});

		const output = parser.html();

		util.expect(output).toBe(
			'<blockquote class="one" >\n<p>hello </p></blockquote>'
		);
	});
	it("should add multiple class to blockquotes", () => {
		const parser = new util.Parser("> hello {.one .two}", {
			use_underscore: true,
			html: true,
		});

		const output = parser.html();

		util.expect(output).toBe(
			'<blockquote class="one two" >\n<p>hello </p></blockquote>'
		);
	});
	it("should add a single class and id to blockquotes", () => {
		const parser = new util.Parser("> hello {.one #myid}", {
			use_underscore: true,
			html: true,
		});

		const output = parser.html();

		util.expect(output).toBe(
			'<blockquote class="one" id="myid">\n<p>hello </p></blockquote>'
		);
	});
});
