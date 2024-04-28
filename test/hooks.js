const fs = require("fs");

exports.mochaHooks = {
    beforeEach(done) {
        fs.rmSync("test/test-files", { recursive: true });
        fs.mkdirSync("test/test-files");
        done();
    },
};
