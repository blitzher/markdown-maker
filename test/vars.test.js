const util = require("./tester.test");

describe("Use variables", () => {
    it('should replace var with the value', () => {
        util.put("#mddef<hi=yo>\n#mdvar<hi>", "sample1.md");
        util.put("there", "sample2.md");

        const output = new util.Parser("test/test.files/sample1.md").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    });
    it('should use variable shorthand', () => {
        util.put("#mddef<hi=yo>\n<hi>", "sample1.md");
        util.put("there", "sample2.md");

        const output = new util.Parser("test/test.files/sample1.md").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    });
    it('should use variables across files', () => {
        util.put("#mddef<hi=yo>\n#mdinclude<sample2.md>", "sample1.md");
        util.put("<hi>", "sample2.md");
        
        const output = new util.Parser("test/test.files/sample1.md").get();

        util.assert.strictEqual(output, "\nyo\n\n")
    })
    it('should put undefined variable', () => {
        util.put("<yo>", "sample1.md");

        const output = new util.Parser("test/test.files/sample1.md").get();

        util.assert.strictEqual(output, "<UNDEFVAR=yo>\n\n");
    });
});



