import { Token } from "./tokenizer.ts";

interface Parser {
    (tokens: Token[]): Program;
}

interface ProgramNode {
    type: string;
}

// in future we will have multiple expression types, for now
// just number literals
export type ExpressionNode = NumberLiteralNode;

// in future we will have multiple statement types, for now
// just print statements
type StatementNode = PrintStatementNode;

export type Program = StatementNode[];

interface NumberLiteralNode extends ProgramNode {
    type: "numberLiteral";
    value: number;
}

interface IdentifierNode extends ProgramNode {
    type: "identifier";
    value: string;
}

interface PrintStatementNode extends ProgramNode {
    type: "printStatement";
    expression: ExpressionNode;
}

interface ParserStep<T extends ProgramNode> {
    (): T;
}

export class ParserError extends Error {
    token: Token;
    constructor(message: string, token: Token) {
        super(message);
        this.token = token;
    }
}

export const parse: Parser = tokens => {
    const tokenIterator = tokens[Symbol.iterator]();
    let currentToken = tokenIterator.next().value;

    const eatToken = () => (currentToken = tokenIterator.next().value);

    const parseExpression: ParserStep<ExpressionNode> = () => {
        let node: ExpressionNode;
        switch (currentToken.type) {
            case "number":
                node = {
                    type: "numberLiteral",
                    value: Number(currentToken.value),
                };
                eatToken();
                return node;
        }
    };

    const parseStatement: ParserStep<StatementNode> = () => {
        if (currentToken.type === "keyword") {
            switch (currentToken.value) {
                case "print":
                    eatToken();
                    return {
                        type: "printStatement",
                        expression: parseExpression(),
                    };
            }
        }
    };

    const nodes: StatementNode[] = [];
    while (currentToken) {
        nodes.push(parseStatement());
    }

    return nodes;
};
