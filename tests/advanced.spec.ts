import util from "./_test-util";

describe("Use of templates", function () {
	it("should import presentation template as expected", function () {
		const output = new util.Parser("#mdtemplate<presentation>").get();
		const template = `<style>html {width: 100vw;height: 100vh;}.slide {padding: 5%;border-radius: 25px;margin: 0;}div > .slide-num {position: absolute;top: 12.5%;right: 15%;/* font-size: 150%; */}body {margin: 5% 15%;}img {max-width: 100%;max-height: 40vh;}</style><script>document.addEventListener("DOMContentLoaded", () => {let current_slide = 0;const all_slides = document.querySelectorAll("div.slide");const num_slides = all_slides.length;all_slides.forEach((slide) => {const num_elem = document.createElement("p");num_elem.classList.add("slide-num");slide.appendChild(num_elem);});onkeydown = (ev) => {if (ev.key == "ArrowRight" && current_slide < all_slides.length - 1)update_slide(++current_slide);else if (ev.key == "ArrowLeft" && current_slide > 0)update_slide(--current_slide);};const update_slide = (index) => {all_slides.forEach((slide) => (slide.style.display = "none"));all_slides[current_slide].style.display = "block";all_slides[current_slide].lastChild.textContent = \`\${current_slide + 1} / \${num_slides}\`;};update_slide(current_slide);});</script>`;

		util.expect(output).toBe(template + "\n\n");
	});

	it("should use custom templates from project extensions.js file", () => {
		util.put(
			"module.exports = {main: (new_template, _) => {new_template('hi', 'hello');}};",
			"extensions.js"
		);
		util.put("#mdtemplate<hi>", "sample1.md");

		util.expect(new util.Parser("tests/test-files/sample1.md").get()).toBe(
			"hello\n\n"
		);
	});

	it("should use custom commands from project extensions.js file", () => {
		util.put(
			'module.exports = {main: (_, new_command) => {new_command(/#teep/, () => "#peet")}};',
			"extensions.js"
		);
		util.put("#teep", "sample1.md");

		const parser = new util.Parser("tests/test-files/sample1.md");
		const output = parser.get();

		util.expect(output).toEqual("#peet\n\n");
	});
});

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

		util.expect(output).toBe("<p>complete</p>\n\n");
	});

	it("should allow for extracting a node from the document as a template using map", () => {
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

		util.expect(output).toBe(
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

		util.expect(output).toBe("<p>hello</p><p>!</p><p>world</p>\n\n");
	});
});
