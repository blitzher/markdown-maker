const fs = require("fs");

exports.mochaHooks = {
    beforeEach(done) {
        fs.rmdirSync("test/test-files", { recursive: true });
        fs.mkdirSync("test/test-files");
        done();
    },
};
