const { ArgumentParser } = require("argparse");
const argParser = new ArgumentParser();

argParser.add_argument("src");
argParser.add_argument("-o", "--output");

console.log(process.argv);

const args = argParser.parse_args(["-o", "output", "hi"]);

console.log(args);
