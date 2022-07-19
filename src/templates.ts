const templates: { [key: string]: string } = {};

function new_template(name: string, content: string) {
    templates[name] = content;
}

const presentation_template = require("../src/templates/presentation.js");
new_template("presentation", presentation_template);

export default templates;
