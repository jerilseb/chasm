import { emitter } from "./emitter.ts";
import { tokenize } from "./tokenizer.ts";
import { parse } from "./parser.ts";
import { hexdump } from "./hexdump.ts";

interface Compiler {
    (src: string): Uint8Array;
}

interface Runtime {
    (src: string, environment: Environment): Promise<TickFunction>;
}

interface TickFunction {
    (): void;
}

interface Environment {
    print: PrintFunction;
}

interface PrintFunction {
    (output: string | number): void;
}

export const compile: Compiler = src => {
    const tokens = tokenize(src);
    const ast = parse(tokens);
    const wasm = emitter(ast);
    return wasm;
};

export const runtime: Runtime = async (src, env: any) => {
    const wasm = compile(src);
    const result: any = await WebAssembly.instantiate(wasm, { env });
    return () => {
        result.instance.exports.run();
    };
};
