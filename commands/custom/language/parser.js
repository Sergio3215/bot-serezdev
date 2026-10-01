const { TokenType } = require("./tokenTypes.js");
const Ast = require("./ast.js");
const { CreateDiagnostic } = require("./diagnostics.js");

class ParseAbort extends Error {}

const StartOf = (value) => value.loc.start;
const EndOf = (value) => value.loc.end;
const LocationFrom = (start, end) => ({
    start: { ...StartOf(start) },
    end: { ...EndOf(end) },
});

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
        this.diagnostics = [];
    }

    parse() {
        const body = [];
        const first = this.peek();
        this.consumeSeparators();

        while (!this.check(TokenType.EOF)) {
            const before = this.current;

            try {
                body.push(this.parseStatement());
            } catch (error) {
                if (!(error instanceof ParseAbort)) {
                    throw error;
                }

                this.synchronize();
                if (this.current === before && !this.check(TokenType.EOF)) {
                    this.advance();
                }
            }

            this.consumeSeparators();
        }

        const eof = this.peek();
        const loc = LocationFrom(first, eof);
        const ast = Ast.CreateProgram(body, loc);

        return {
            ok: this.diagnostics.length === 0,
            value: { ast },
            diagnostics: this.diagnostics,
        };
    }

    parseStatement() {
        if (this.check(TokenType.LEFT_BRACE)) {
            return this.parseBlockStatement();
        }

        if (this.check(TokenType.LET) || this.check(TokenType.CONST)) {
            const declaration = this.parseVariableDeclaration(false);
            this.finishSimpleStatement();
            return declaration;
        }

        if (this.check(TokenType.IF)) {
            return this.parseIfStatement();
        }

        if (this.check(TokenType.FOR)) {
            return this.parseForOfStatement();
        }

        if (this.match(TokenType.BREAK)) {
            const node = Ast.CreateBreakStatement(this.previous().loc);
            this.finishSimpleStatement();
            return node;
        }

        if (this.match(TokenType.CONTINUE)) {
            const node = Ast.CreateContinueStatement(this.previous().loc);
            this.finishSimpleStatement();
            return node;
        }

        const expression = this.parseExpression();
        const statement = Ast.CreateExpressionStatement(expression, expression.loc);
        this.finishSimpleStatement();
        return statement;
    }

    parseBlockStatement() {
        const start = this.consume(TokenType.LEFT_BRACE, "Se esperaba '{'");
        const body = [];
        this.consumeSeparators();

        while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
            const before = this.current;

            try {
                body.push(this.parseStatement());
            } catch (error) {
                if (!(error instanceof ParseAbort)) {
                    throw error;
                }

                this.synchronize();
                if (this.current === before && !this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
                    this.advance();
                }
            }

            this.consumeSeparators();
        }

        const end = this.consume(TokenType.RIGHT_BRACE, "Se esperaba '}' para cerrar el bloque");
        return Ast.CreateBlockStatement(body, LocationFrom(start, end));
    }

    parseVariableDeclaration(forOf) {
        const start = this.advance();
        const kind = start.type === TokenType.LET ? "let" : "const";
        const declarations = [];

        while (true) {
            this.skipNewlines();
            const identifierToken = this.consume(
                TokenType.IDENTIFIER,
                "Se esperaba el nombre de la variable",
            );
            const identifier = Ast.CreateIdentifier(identifierToken.value, identifierToken.loc);
            let init = null;

            if (!forOf) {
                this.skipNewlines();
                this.consume(TokenType.ASSIGN, "Toda variable debe tener un valor inicial");
                this.skipNewlines();
                init = this.parseExpression();
            }

            declarations.push(
                Ast.CreateVariableDeclarator(
                    identifier,
                    init,
                    LocationFrom(identifier, init ?? identifier),
                ),
            );

            if (forOf) {
                this.skipNewlines();
                break;
            }

            if (!this.match(TokenType.COMMA)) {
                break;
            }
        }

        const end = declarations[declarations.length - 1];
        return Ast.CreateVariableDeclaration(kind, declarations, LocationFrom(start, end));
    }

    parseIfStatement() {
        const start = this.consume(TokenType.IF, "Se esperaba 'if'");
        this.skipNewlines();
        this.consume(TokenType.LEFT_PAREN, "Se esperaba '(' después de if");
        this.skipNewlines();
        const test = this.parseExpression();
        this.skipNewlines();
        this.consume(TokenType.RIGHT_PAREN, "Se esperaba ')' después de la condición");
        this.skipNewlines();
        const consequent = this.parseRequiredBlock("El cuerpo de if debe ser un bloque");
        let alternate = null;

        this.consumeSeparators();
        if (this.match(TokenType.ELSE)) {
            this.skipNewlines();
            alternate = this.check(TokenType.IF)
                ? this.parseIfStatement()
                : this.parseRequiredBlock("El cuerpo de else debe ser un bloque");
        }

        return Ast.CreateIfStatement(
            test,
            consequent,
            alternate,
            LocationFrom(start, alternate ?? consequent),
        );
    }

    parseForOfStatement() {
        const start = this.consume(TokenType.FOR, "Se esperaba 'for'");
        this.skipNewlines();
        this.consume(TokenType.LEFT_PAREN, "Se esperaba '(' después de for");
        this.skipNewlines();

        if (!this.check(TokenType.LET) && !this.check(TokenType.CONST)) {
            this.fail(
                this.peek(),
                "INVALID_FOR_OF_DECLARATION",
                "for...of debe declarar su variable con let o const",
            );
        }

        const left = this.parseVariableDeclaration(true);
        this.skipNewlines();
        this.consume(TokenType.OF, "Se esperaba 'of' en el bucle");
        this.skipNewlines();
        const right = this.parseExpression();
        this.skipNewlines();
        this.consume(TokenType.RIGHT_PAREN, "Se esperaba ')' después de for...of");
        this.skipNewlines();
        const body = this.parseRequiredBlock("El cuerpo de for...of debe ser un bloque");

        return Ast.CreateForOfStatement(left, right, body, LocationFrom(start, body));
    }

    parseRequiredBlock(message) {
        if (!this.check(TokenType.LEFT_BRACE)) {
            this.fail(this.peek(), "EXPECTED_BLOCK", message);
        }

        return this.parseBlockStatement();
    }

    parseExpression() {
        return this.parseAssignment();
    }

    parseAssignment() {
        const left = this.parseLogicalOr();

        if (this.match(TokenType.ASSIGN, TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN)) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseAssignment();
            return Ast.CreateAssignmentExpression(
                operator.value,
                left,
                right,
                LocationFrom(left, right),
            );
        }

        return left;
    }

    parseLogicalOr() {
        let expression = this.parseLogicalAnd();

        while (this.match(TokenType.LOGICAL_OR)) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseLogicalAnd();
            expression = Ast.CreateLogicalExpression(
                operator.value,
                expression,
                right,
                LocationFrom(expression, right),
            );
        }

        return expression;
    }

    parseLogicalAnd() {
        let expression = this.parseEquality();

        while (this.match(TokenType.LOGICAL_AND)) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseEquality();
            expression = Ast.CreateLogicalExpression(
                operator.value,
                expression,
                right,
                LocationFrom(expression, right),
            );
        }

        return expression;
    }

    parseEquality() {
        let expression = this.parseComparison();

        while (this.match(TokenType.STRICT_EQUAL, TokenType.STRICT_NOT_EQUAL)) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseComparison();
            expression = Ast.CreateBinaryExpression(
                operator.value,
                expression,
                right,
                LocationFrom(expression, right),
            );
        }

        return expression;
    }

    parseComparison() {
        let expression = this.parseTerm();

        while (this.match(
            TokenType.LESS,
            TokenType.LESS_EQUAL,
            TokenType.GREATER,
            TokenType.GREATER_EQUAL,
        )) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseTerm();
            expression = Ast.CreateBinaryExpression(
                operator.value,
                expression,
                right,
                LocationFrom(expression, right),
            );
        }

        return expression;
    }

    parseTerm() {
        let expression = this.parseFactor();

        while (this.match(TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseFactor();
            expression = Ast.CreateBinaryExpression(
                operator.value,
                expression,
                right,
                LocationFrom(expression, right),
            );
        }

        return expression;
    }

    parseFactor() {
        let expression = this.parseUnary();

        while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT)) {
            const operator = this.previous();
            this.skipNewlines();
            const right = this.parseUnary();
            expression = Ast.CreateBinaryExpression(
                operator.value,
                expression,
                right,
                LocationFrom(expression, right),
            );
        }

        return expression;
    }

    parseUnary() {
        if (this.match(TokenType.INCREMENT, TokenType.DECREMENT)) {
            const operator = this.previous();
            this.skipNewlines();
            const argument = this.parseUnary();
            return Ast.CreateUpdateExpression(
                operator.value,
                argument,
                true,
                LocationFrom(operator, argument),
            );
        }

        if (this.match(TokenType.NOT, TokenType.PLUS, TokenType.MINUS)) {
            const operator = this.previous();
            this.skipNewlines();
            const argument = this.parseUnary();
            return Ast.CreateUnaryExpression(
                operator.value,
                argument,
                true,
                LocationFrom(operator, argument),
            );
        }

        return this.parsePostfix();
    }

    parsePostfix() {
        let expression = this.parsePrimary();

        while (true) {
            if (this.match(TokenType.DOT)) {
                const propertyToken = this.consume(
                    TokenType.IDENTIFIER,
                    "Se esperaba una propiedad después de '.'",
                );
                const property = Ast.CreateIdentifier(propertyToken.value, propertyToken.loc);
                expression = Ast.CreateMemberExpression(
                    expression,
                    property,
                    false,
                    LocationFrom(expression, property),
                );
                continue;
            }

            if (this.match(TokenType.LEFT_BRACKET)) {
                this.skipNewlines();
                const property = this.parseExpression();
                this.skipNewlines();
                const end = this.consume(TokenType.RIGHT_BRACKET, "Se esperaba ']' después del índice");
                expression = Ast.CreateMemberExpression(
                    expression,
                    property,
                    true,
                    LocationFrom(expression, end),
                );
                continue;
            }

            if (this.match(TokenType.LEFT_PAREN)) {
                if (expression.type !== Ast.NodeType.IDENTIFIER) {
                    this.fail(
                        this.previous(),
                        "INVALID_CALLEE",
                        "Solo se pueden llamar funciones mediante un identificador",
                    );
                }

                const args = this.parseExpressionList(TokenType.RIGHT_PAREN, "argumentos");
                const end = this.consume(TokenType.RIGHT_PAREN, "Se esperaba ')' después de los argumentos");
                expression = Ast.CreateCallExpression(
                    expression,
                    args,
                    LocationFrom(expression, end),
                );
                continue;
            }

            if (this.match(TokenType.INCREMENT, TokenType.DECREMENT)) {
                const operator = this.previous();
                expression = Ast.CreateUpdateExpression(
                    operator.value,
                    expression,
                    false,
                    LocationFrom(expression, operator),
                );
            }

            break;
        }

        return expression;
    }

    parsePrimary() {
        if (this.match(TokenType.STRING)) {
            return Ast.CreateStringLiteral(this.previous().value, this.previous().loc);
        }

        if (this.match(TokenType.NUMBER)) {
            return Ast.CreateNumberLiteral(this.previous().value, this.previous().loc);
        }

        if (this.match(TokenType.TRUE, TokenType.FALSE)) {
            return Ast.CreateBooleanLiteral(this.previous().type === TokenType.TRUE, this.previous().loc);
        }

        if (this.match(TokenType.NULL)) {
            return Ast.CreateNullLiteral(this.previous().loc);
        }

        if (this.match(TokenType.IDENTIFIER)) {
            return Ast.CreateIdentifier(this.previous().value, this.previous().loc);
        }

        if (this.match(TokenType.LEFT_PAREN)) {
            this.skipNewlines();
            const expression = this.parseExpression();
            this.skipNewlines();
            this.consume(TokenType.RIGHT_PAREN, "Se esperaba ')' después de la expresión");
            return expression;
        }

        if (this.match(TokenType.LEFT_BRACE)) {
            return this.parseObjectExpression(this.previous());
        }

        if (this.match(TokenType.LEFT_BRACKET)) {
            return this.parseArrayExpression(this.previous());
        }

        this.fail(this.peek(), "EXPECTED_EXPRESSION", "Se esperaba una expresión");
    }

    parseObjectExpression(start) {
        const properties = [];
        this.skipNewlines();

        while (!this.check(TokenType.RIGHT_BRACE) && !this.check(TokenType.EOF)) {
            const keyToken = this.consume(
                TokenType.IDENTIFIER,
                "Las claves de un objeto deben ser identificadores sin comillas",
            );
            const key = Ast.CreateIdentifier(keyToken.value, keyToken.loc);
            this.skipNewlines();
            this.consume(TokenType.COLON, "Se esperaba ':' después de la propiedad");
            this.skipNewlines();
            const value = this.parseExpression();
            properties.push(Ast.CreateProperty(key, value, LocationFrom(key, value)));
            this.skipNewlines();

            if (!this.match(TokenType.COMMA)) {
                break;
            }

            this.skipNewlines();
            if (this.check(TokenType.RIGHT_BRACE)) {
                break;
            }
        }

        const end = this.consume(TokenType.RIGHT_BRACE, "Se esperaba '}' después del objeto");
        return Ast.CreateObjectExpression(properties, LocationFrom(start, end));
    }

    parseArrayExpression(start) {
        const elements = this.parseExpressionList(TokenType.RIGHT_BRACKET, "array");
        const end = this.consume(TokenType.RIGHT_BRACKET, "Se esperaba ']' después del array");
        return Ast.CreateArrayExpression(elements, LocationFrom(start, end));
    }

    parseExpressionList(endType, description) {
        const expressions = [];
        this.skipNewlines();

        while (!this.check(endType) && !this.check(TokenType.EOF)) {
            expressions.push(this.parseExpression());
            this.skipNewlines();

            if (!this.match(TokenType.COMMA)) {
                break;
            }

            this.skipNewlines();
            if (this.check(endType)) {
                break;
            }
        }

        if (!this.check(endType) && !this.check(TokenType.EOF)) {
            this.fail(
                this.peek(),
                "EXPECTED_COMMA",
                `Se esperaba una coma entre los valores de ${description}`,
            );
        }

        return expressions;
    }

    finishSimpleStatement() {
        if (this.match(TokenType.SEMICOLON)) {
            return;
        }

        if (this.match(TokenType.NEWLINE)) {
            while (this.match(TokenType.NEWLINE, TokenType.SEMICOLON)) {}
            return;
        }

        if (this.check(TokenType.RIGHT_BRACE) || this.check(TokenType.EOF)) {
            return;
        }

        this.fail(
            this.peek(),
            "EXPECTED_STATEMENT_END",
            "Se esperaba un salto de línea o ';' al final de la instrucción",
        );
    }

    consumeSeparators() {
        while (this.match(TokenType.NEWLINE, TokenType.SEMICOLON)) {}
    }

    skipNewlines() {
        while (this.match(TokenType.NEWLINE)) {}
    }

    synchronize() {
        while (!this.check(TokenType.EOF)) {
            if (this.check(TokenType.NEWLINE) || this.check(TokenType.SEMICOLON)) {
                this.advance();
                return;
            }

            if (this.check(TokenType.RIGHT_BRACE)) {
                return;
            }

            this.advance();
        }
    }

    consume(type, message) {
        if (this.check(type)) {
            return this.advance();
        }

        this.fail(this.peek(), "UNEXPECTED_TOKEN", message);
    }

    fail(token, code, message) {
        this.diagnostics.push(
            CreateDiagnostic("parser", code, message, token.loc.start, token.loc.end),
        );
        throw new ParseAbort(message);
    }

    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }

        return false;
    }

    check(type) {
        return this.peek().type === type;
    }

    advance() {
        if (!this.check(TokenType.EOF)) {
            this.current += 1;
        }
        return this.previous();
    }

    peek() {
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[Math.max(0, this.current - 1)];
    }
}

const Parse = (tokens) => {
    if (!Array.isArray(tokens) || tokens.length === 0) {
        const origin = { line: 1, column: 0, offset: 0 };
        return {
            ok: false,
            value: { ast: null },
            diagnostics: [
                CreateDiagnostic(
                    "parser",
                    "INVALID_TOKENS",
                    "El parser requiere una lista de tokens",
                    origin,
                    origin,
                ),
            ],
        };
    }

    return new Parser(tokens).parse();
};

module.exports = {
    Parser,
    Parse,
};
