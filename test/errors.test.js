const util = require("./tester.test.js");

describe("Error handling", () => {
    it("should traceback across file includes", () => {
        util.put("\n#mdinclude<sample2.md>", "sample1.md")
        util.put("#mdNON", "sample2.md")

        const parser = new util.Parser("test/test.files/sample1.md");

        let e;

        /* should throw SyntaxError */
        util.assert.throws(
            /* run parser, but store error for further inspection */
            () => {try {parser.get()} catch (_e) {e = _e; throw _e}},
            SyntaxError
        )

        /* ...where the error message is the traceback on line 2 -> */
        
        /** depending on the system, the colour keys are appended
         * to the relevant string or not.
         * both cases are acceptable, so try with colours, and 
         * if it fails, try without.
         * only if both fails should the test fail
         */
        try { /* with colours */
            util.assert.strictEqual(
            e.message,
            'Unknown token: #mdNON\x1B[90m\n' +
            '...on line 1 in test/test.files/sample2.md\x1B[39m\x1B[90m\n' +
            '...on line 2 in test/test.files/sample1.md\x1B[39m'
        )}
        
        catch (_e) { /* without colors */
            util.assert.strictEqual(
                e.message,
                'Unknown token: #mdNON\n' +
                '...on line 1 in test/test.files/sample2.md\n' +
                '...on line 2 in test/test.files/sample1.md'
            )
        }
    })
});