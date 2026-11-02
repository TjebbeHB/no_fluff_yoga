// Prints every audio-guide line as JSON ({ id: text }) for generate_voices.py.
// node scripts/export_guide_lines.cjs > lines.json
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
const { GUIDE_LINES } = require("../src/guideScript.ts");
process.stdout.write(JSON.stringify(GUIDE_LINES, null, 2) + "\n");
