import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const sourcePath = path.join(root, "contracts", "CampusEdition.sol");
const outputPath = path.join(root, "contracts", "artifacts", "CampusEdition.json");

const input = {
  language: "Solidity",
  sources: { "contracts/CampusEdition.sol": { content: fs.readFileSync(sourcePath, "utf8") } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } },
  },
};

function findImports(importPath) {
  const candidate = path.join(root, "node_modules", importPath);
  if (!fs.existsSync(candidate)) return { error: `Import not found: ${importPath}` };
  return { contents: fs.readFileSync(candidate, "utf8") };
}

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (output.errors || []).filter((item) => item.severity === "error");
if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join("\n"));

const contract = output.contracts["contracts/CampusEdition.sol"].CampusEdition;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify({ abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`, deployedBytecode: `0x${contract.evm.deployedBytecode.object}` }, null, 2)}\n`);
console.log(outputPath);
