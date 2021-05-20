const util = require("./tester.test");

describe("Use variables", () => {
    it('should replace var with the value', () => {
        const output = new util.Parser("#mddef<hi=yo>\n#mdvar<hi>").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    });
    it('should use variable shorthand', () => {
        const output = new util.Parser("#mddef<hi=yo>\n<hi>").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    });
    it('should use variables across files', () => {
        util.put("#mddef<hi=yo>\n#mdinclude<sample2.md>", "sample1.md");
        util.put("<hi>", "sample2.md");

        const output = new util.Parser("test/test-files/sample1.md").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    })
    it('should throw if undefined variable', () => {

        const parser = new util.Parser("<yo>");

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
        );



    });

    it('should preserve whatever comes after', () => {
        const output = new util.Parser("#mddef<hi=yo>\n<hi>,").get();
        util.assert.strictEqual(output, "\nyo,\n\n");
    });

    it('should replace underscore with space', () => {
        const output = new util.Parser("#mddef<name=Mr_Sir>\n#mdvar<name>").get();

        util.assert.strictEqual(output, "\nMr Sir\n\n")
    });

});



