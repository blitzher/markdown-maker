const util = require("./tester.test.js");

describe("Error handling", () => {
    it("should provide basic traceback", () => {
        util.put("hi there\n\n\n#mdNON\n\n", "sample1.md");

        const parser = new util.Parser("test/test-files/sample1.md");

        let e;
        /* should throw an error */
        util.assert.throws(
            () => {
                try {
                    parser.get();
                } catch (_e) {
                    e = _e;
                    throw _e;
                }
            }
        )

        /**
         * ..and error message should provide
         * info as to where the error occured
         */
        util.assert.strictEqual(
            e.message,
            "Unknown token: #mdNON" +
            "\n...on line 4 in test/test-files/sample1.md".grey(15)
        )

    });
    it("should traceback across file includes", () => {
        util.put("\n#mdinclude<sample2.md>", "sample1.md");
        util.put("#mdNON", "sample2.md");

        const parser = new util.Parser("test/test-files/sample1.md");

        let e;

        /* should throw SyntaxError */
        util.assert.throws(
            /* run parser, but store error for further inspection */
            () => {
                try {
                    parser.get();
                } catch (_e) {
                    e = _e;
                    throw _e;
                }
            },
            SyntaxError
        );

        /* ...where the error message is the traceback on line 2 -> */
        let answer = "Unknown token: #mdNON" +
            "\n...on line 1 in test/test-files/sample2.md".grey(15) +
            "\n...on line 2 in test/test-files/sample1.md".grey(15);

        util.assert.strictEqual(
            e.message.replace(/(\\)+/g, "/"),
            answer
        );
    });
});
