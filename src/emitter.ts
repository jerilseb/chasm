import { unsignedLEB128, encodeString, signedLEB128, ieee754 } from "./encoding.ts";
import { Program, ProgramNode, ExpressionNode, StatementNode } from "./parser.ts";

interface Emitter {
    (ast: Program): Uint8Array;
}

interface Traverse<E extends ProgramNode> {
    (nodes: E[] | E, visitor: Visitor<E>): void;
}

interface Visitor<E> {
    (node: E): void;
}

const flatten = (arr: any[]) => [].concat.apply([], arr);

// https://webassembly.github.io/spec/core/binary/modules.html#sections
enum Section {
    custom = 0,
    type = 1,
    import = 2,
    func = 3,
    table = 4,
    memory = 5,
    global = 6,
    export = 7,
    start = 8,
    element = 9,
    code = 10,
    data = 11,
}

// https://webassembly.github.io/spec/core/binary/types.html
enum Valtype {
    i32 = 0x7f,
    f32 = 0x7d,
}

// https://webassembly.github.io/spec/core/binary/types.html#binary-blocktype
enum Blocktype {
    void = 0x40,
}

// https://webassembly.github.io/spec/core/binary/instructions.html
enum Opcodes {
    block = 0x02,
    loop = 0x03,
    br = 0x0c,
    br_if = 0x0d,
    end = 0x0b,
    call = 0x10,
    get_local = 0x20,
    set_local = 0x21,
    f32_const = 0x43,
    i32_eqz = 0x45,
    f32_eq = 0x5b,
    f32_lt = 0x5d,
    f32_gt = 0x5e,
    i32_and = 0x71,
    f32_add = 0x92,
    f32_sub = 0x93,
    f32_mul = 0x94,
    f32_div = 0x95,
}

const binaryOpcode = {
    "+": Opcodes.f32_add,
    "-": Opcodes.f32_sub,
    "*": Opcodes.f32_mul,
    "/": Opcodes.f32_div,
    "==": Opcodes.f32_eq,
    ">": Opcodes.f32_gt,
    "<": Opcodes.f32_lt,
    "&&": Opcodes.i32_and,
};

// http://webassembly.github.io/spec/core/binary/modules.html#export-section
enum ExportType {
    func = 0x00,
    table = 0x01,
    mem = 0x02,
    global = 0x03,
}

// http://webassembly.github.io/spec/core/binary/types.html#function-types
const functionType = 0x60;

const emptyArray = 0x0;

// https://webassembly.github.io/spec/core/binary/modules.html#binary-module
const magicModuleHeader = [0x00, 0x61, 0x73, 0x6d];
const moduleVersion = [0x01, 0x00, 0x00, 0x00];

// https://webassembly.github.io/spec/core/binary/conventions.html#binary-vec
// Vectors are encoded with their length followed by their element sequence
const encodeVector = (data: any[]): number[] => {
    let vector = [...unsignedLEB128(data.length), ...flatten(data)];
    return vector;
};

// https://webassembly.github.io/spec/core/binary/modules.html#code-section
const encodeLocal = (count: number, type: Valtype) => [unsignedLEB128(count), type];

// https://webassembly.github.io/spec/core/binary/modules.html#sections
// sections are encoded by their type followed by their vector contents
const createSection = (sectionType: Section, data: any[]): number[] => [
    sectionType,
    ...encodeVector(data),
];

const traverse: Traverse<ExpressionNode> = (nodes, visitor) => {
    nodes = Array.isArray(nodes) ? nodes : [nodes];
    nodes.forEach(node => {
        Object.keys(node).forEach(prop => {
            const value = node[prop];
            const valueAsArray: string[] = Array.isArray(value) ? value : [value];
            valueAsArray.forEach((childNode: any) => {
                if (typeof childNode.type === "string") {
                    traverse(childNode, visitor);
                }
            });
        });
        visitor(node);
    });
};

const codeFromAst = (ast: Program) => {
    const code: number[] = [];
    const symbols = new Map<string, number>();

    const localIndexForSymbol = (name: string) => {
        if (!symbols.has(name)) {
            symbols.set(name, symbols.size);
        }
        return symbols.get(name);
    };

    const emitExpression = (node: ExpressionNode) =>
        traverse(node, (node: ExpressionNode) => {
            switch (node.type) {
                case "numberLiteral":
                    code.push(Opcodes.f32_const);
                    code.push(...ieee754(node.value));
                    break;
                case "identifier":
                    code.push(Opcodes.get_local);
                    code.push(...unsignedLEB128(localIndexForSymbol(node.value)));
                    break;
                case "binaryExpression":
                    code.push(binaryOpcode[node.operator]);
                    break;
            }
        });

    const emitStatements = (statements: StatementNode[]) =>
        statements.forEach(statement => {
            switch (statement.type) {
                case "printStatement":
                    emitExpression(statement.expression);
                    code.push(Opcodes.call);
                    code.push(...unsignedLEB128(0));
                    break;
                case "variableDeclaration":
                    emitExpression(statement.initializer);
                    code.push(Opcodes.set_local);
                    code.push(...unsignedLEB128(localIndexForSymbol(statement.name)));
                    break;
                case "variableAssignment":
                    emitExpression(statement.value);
                    code.push(Opcodes.set_local);
                    code.push(...unsignedLEB128(localIndexForSymbol(statement.name)));
                    break;
                case "whileStatement":
                    // outer block
                    code.push(Opcodes.block);
                    code.push(Blocktype.void);
                    // inner loop
                    code.push(Opcodes.loop);
                    code.push(Blocktype.void);
                    // compute the while expression
                    emitExpression(statement.expression);
                    code.push(Opcodes.i32_eqz);
                    // br_if $label0
                    code.push(Opcodes.br_if);
                    code.push(...signedLEB128(1));
                    // the nested logic
                    emitStatements(statement.statements);
                    // br $label1
                    code.push(Opcodes.br);
                    code.push(...signedLEB128(0));
                    // end loop
                    code.push(Opcodes.end);
                    // end block
                    code.push(Opcodes.end);
                    break;
            }
        });

    emitStatements(ast);

    return { code, localCount: symbols.size };
};

export const emitter: Emitter = (ast: Program) => {
    // Function types are vectors of parameters and return types. Currently
    // WebAssembly only supports single return values
    const voidVoidType = [functionType, emptyArray, emptyArray];

    const floatVoidType = [functionType, ...encodeVector([Valtype.f32]), emptyArray];

    // the type section is a vector of function types
    const typeSection = createSection(Section.type, encodeVector([voidVoidType, floatVoidType]));

    // the function section is a vector of type indices that indicate the type of each function
    // in the code section
    const funcSection = createSection(Section.func, encodeVector([0x00 /* type index */]));

    // the import section is a vector of imported functions
    const printFunctionImport = [
        ...encodeString("env"),
        ...encodeString("print"),
        ExportType.func,
        0x01, // type index
    ];

    const importSection = createSection(Section.import, encodeVector([printFunctionImport]));

    // the export section is a vector of exported functions
    const exportSection = createSection(
        Section.export,
        encodeVector([[...encodeString("run"), ExportType.func, 0x01 /* function index */]])
    );

    // the code section contains vectors of functions
    const { code, localCount } = codeFromAst(ast);
    const locals = localCount > 0 ? [encodeLocal(localCount, Valtype.f32)] : [];

    const functionBody = encodeVector([...encodeVector(locals), ...code, Opcodes.end]);

    const codeSection = createSection(Section.code, encodeVector([functionBody]));

    return Uint8Array.from([
        ...magicModuleHeader,
        ...moduleVersion,
        ...typeSection,
        ...importSection,
        ...funcSection,
        ...exportSection,
        ...codeSection,
    ]);
};
