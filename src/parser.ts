import { Token } from "./tokenizer.ts";

interface Parser {
    (tokens: Token[]): Program;
}

export interface ProgramNode {
    type: string;
}

type Operator = "+" | "-" | "/" | "*" | "==" | ">" | "<" | "&&";
// in future we will have multiple expression types, for now
// just number literals
export type ExpressionNode = NumberLiteralNode | BinaryExpressionNode | IdentifierNode;

// in future we will have multiple statement types, for now
// just print statements
export type StatementNode =
    | PrintStatementNode
    | VariableDeclarationNode
    | VariableAssignmentNode
    | WhileStatementNode;

export type Program = StatementNode[];

interface VariableDeclarationNode extends ProgramNode {
    type: "variableDeclaration";
    name: string;
    initializer: ExpressionNode;
}

interface VariableAssignmentNode extends ProgramNode {
    type: "variableAssignment";
    name: string;
    value: ExpressionNode;
}

interface NumberLiteralNode extends ProgramNode {
    type: "numberLiteral";
    value: number;
}

interface IdentifierNode extends ProgramNode {
    type: "identifier";
    value: string;
}

interface BinaryExpressionNode extends ProgramNode {
    type: "binaryExpression";
    left: ExpressionNode;
    right: ExpressionNode;
    operator: Operator;
}

interface IdentifierNode extends ProgramNode {
    type: "identifier";
    value: string;
}

interface PrintStatementNode extends ProgramNode {
    type: "printStatement";
    expression: ExpressionNode;
}

interface WhileStatementNode extends ProgramNode {
    type: "whileStatement";
    expression: ExpressionNode;
    statements: StatementNode[];
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

const asOperator = (value: string): Operator => {
    // TODO: check it really is an operator
    return value as Operator;
};

export const parse: Parser = tokens => {
    const tokenIterator = tokens[Symbol.iterator]();
    let currentToken = tokenIterator.next().value;

    const currentTokenIsKeyword = (name: string) =>
        currentToken.value === name && currentToken.type === "keyword";

    const eatToken = (value?: string) => {
        if (value && value !== currentToken.value) {
            throw new ParserError(
                `Unexpected token value, expected ${value}, received ${currentToken.value}`,
                currentToken
            );
        }
        currentToken = tokenIterator.next().value;
    };

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
            case "parens":
                eatToken("(");
                const left = parseExpression();
                const operator = currentToken.value;
                eatToken();
                const right = parseExpression();
                eatToken(")");
                return {
                    type: "binaryExpression",
                    left,
                    right,
                    operator: asOperator(operator),
                };
            case "identifier":
                node = { type: "identifier", value: currentToken.value };
                eatToken();
                return node;
            default:
                throw new ParserError(`Unexpected token type ${currentToken.type}`, currentToken);
        }
    };

    const parsePrintStatement: ParserStep<PrintStatementNode> = () => {
        eatToken("print");
        return {
            type: "printStatement",
            expression: parseExpression(),
        };
    };

    const parseWhileStatement: ParserStep<WhileStatementNode> = () => {
        eatToken("while");

        const expression = parseExpression();

        const statements: StatementNode[] = [];
        while (!currentTokenIsKeyword("endwhile")) {
            statements.push(parseStatement());
        }

        eatToken("endwhile");

        return { type: "whileStatement", expression, statements };
    };

    const parseVariableAssignment: ParserStep<VariableAssignmentNode> = () => {
        const name = currentToken.value;
        eatToken();
        eatToken("=");
        return { type: "variableAssignment", name, value: parseExpression() };
    };

    const parseVariableDeclarationStatement: ParserStep<VariableDeclarationNode> = () => {
        eatToken("var");
        const name = currentToken.value;
        eatToken();
        eatToken("=");
        return {
            type: "variableDeclaration",
            name,
            initializer: parseExpression(),
        };
    };

    const parseStatement: ParserStep<StatementNode> = () => {
        if (currentToken.type === "keyword") {
            switch (currentToken.value) {
                case "print":
                    return parsePrintStatement();
                case "var":
                    return parseVariableDeclarationStatement();
                case "while":
                    return parseWhileStatement();
                default:
                    throw new ParserError(`Unknown keyword ${currentToken.value}`, currentToken);
            }
        } else if (currentToken.type === "identifier") {
            return parseVariableAssignment();
        }
    };

    const nodes: StatementNode[] = [];
    while (currentToken) {
        nodes.push(parseStatement());
    }

    return nodes;
};
