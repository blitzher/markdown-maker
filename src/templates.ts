const templates: { [key: string]: string } = {};

function new_template(name: string, content: string) {
    templates[name] = content;
}

/* initialize default templates */
const presentation_template = require("../src/templates/presentation.js");
const mathjax_template = require("../src/templates/mathjax.js");
new_template("presentation", presentation_template);
new_template("mathjax", mathjax_template);

export default templates;
