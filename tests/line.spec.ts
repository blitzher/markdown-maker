import util from "./_test-util";

describe("Managing blank lines", () => {
	it("should always end with 2 blank lines, even with no input", () => {
		const output = new util.Parser("").get();
		util.expect(output).toBe("\n\n");
	});

	it("should reduce blank lines to 2", () => {
		const output1 = new util.Parser("\n\n\n\n").get();
		util.expect(output1).toBe("\n\n");

		const output2 = new util.Parser("\n\n\n\nHello!").get();
		util.expect(output2).toBe("\n\nHello!\n\n");
	});

	it("should allow words when removing blank lines", () => {
		const output = new util.Parser("hii\n\n\n").get();
		util.expect(output).toBe("hii\n\n");
	});
});
