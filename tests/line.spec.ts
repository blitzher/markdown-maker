import util from "./_test-util";
import assert from "assert";

describe("Managing blank lines", () => {
	it("should always end with 2 blank lines, even with no input", () => {
		const output = new util.Parser("").get();
		assert.strictEqual(output, "\n\n");
	});

	it("should reduce blank lines to 2", () => {
		const output1 = new util.Parser("\n\n\n\n").get();
		assert.strictEqual(output1, "\n\n");

		const output2 = new util.Parser("\n\n\n\nHello!").get();
		assert.strictEqual(output2, "\n\nHello!\n\n");
	});

	it("should allow words when removing blank lines", () => {
		const output = new util.Parser("hii\n\n\n").get();
		assert.strictEqual(output, "hii\n\n");
	});
});
