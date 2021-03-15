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
        
        const output = new util.Parser("test/test.files/sample1.md").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    })
    it('should put undefined variable', () => {
        const output = new util.Parser("<yo>").get();

        util.assert.strictEqual(output, "<UNDEFVAR=yo>\n\n");
    });

    it('should preserve whatever comes after', () => {
        const output = new util.Parser("#mddef<hi=yo>\n<hi>,").get();
        util.assert.strictEqual(output, "\nyo,\n\n");
    });
});



