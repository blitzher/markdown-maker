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
    it("should dissallow loading a folder without an entry file", () => {
        util.put("#mdinclude<sample_fld>", "sample1.md");
        util.putDir("sample_fld");

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
            'No entry file found in folder "sample_fld". Looking for "sample_fld.md"' +
            "\n...on line 1 in test/test-files/sample1.md".grey(15);

        util.assert.strictEqual(e.message.replace(/(\\)+/g, "/"), answer);
    });
});
