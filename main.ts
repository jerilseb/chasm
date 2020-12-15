import { compile } from "./src/compiler.ts";

let program = await Deno.readTextFile("test.chasm");
const wasm = compile(program);
await Deno.writeFile("out.wasm", wasm);

let importObj = {
    env: {
        print: value => {
            console.log(value);
        },
    },
};

const result: any = await WebAssembly.instantiate(wasm, importObj);
result.instance.exports.run();
