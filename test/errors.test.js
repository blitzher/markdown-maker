const { Parser } = require("marked");
const util = require("./tester.test.js");

describe("Error handling", () => {
    it("should dissallow undefined templates", () => {
        util.put("#mdtemplate<UNDEF>", "sample1.md");

        const parser = new util.Parser("test/test-files/sample1.md");

        let e;
        util.assert.throws(() => {
            try {
                parser.get();
            } catch (_e) {
                e = _e;
                throw _e;
            }
        }, Error);

        let answer =
            'Template "UNDEF" not found!' +
            "\n...on line 1 in test/test-files/sample1.md".grey(15);

        util.assert.strictEqual(e.message.replace(/(\\)+/g, "/"), answer);
    });
});
