const {
    TokenType,
    KeywordTokenTypes,
    DelimiterTokenTypes,
    OperatorTokenTypes,
    OperatorLexemes,
} = require("./tokenTypes.js");
const {
    CreatePosition,
    CreateLocation,
    CreateDiagnostic,
} = require("./diagnostics.js");

const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER_PART = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;
const HEX_DIGIT = /[0-9A-Fa-f]/;

const ESCAPE_VALUES = Object.freeze({
    "\\": "\\",
    "\"": "\"",
    "'": "'",
    n: "\n",
    r: "\r",
    t: "\t",
    b: "\b",
    f: "\f",
    v: "\v",
    0: "\0",
});

class Tokenizer {
    constructor(source) {
        this.source = source;
        this.offset = 0;
        this.line = 1;
        this.column = 0;
        this.tokens = [];
        this.diagnostics = [];
    }

    tokenize() {
        while (!this.isAtEnd()) {
            const character = this.peek();

            if (character === " " || character === "\t" || character === "\f" || character === "\v") {
                this.advance();
                continue;
            }

            if (character === "\n" || character === "\r") {
                this.scanNewline();
                continue;
            }

            if (character === "/" && this.peek(1) === "/") {
                this.scanLineComment();
                continue;
            }

            if (character === "/" && this.peek(1) === "*") {
                this.scanBlockComment();
                continue;
            }

            if (character === "\"" || character === "'") {
                this.scanString();
                continue;
            }

            if (DIGIT.test(character)) {
                this.scanNumber();
                continue;
            }

            if (IDENTIFIER_START.test(character)) {
                this.scanIdentifier();
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(DelimiterTokenTypes, character)) {
                const start = this.position();
                this.advance();
                this.addToken(DelimiterTokenTypes[character], character, start, this.position(), character);
                continue;
            }

            if (this.scanOperator()) {
                continue;
            }

            const start = this.position();
            const invalidCharacter = this.advance();
            const code = invalidCharacter === "`"
                ? "TEMPLATE_STRING_NOT_SUPPORTED"
                : "UNEXPECTED_CHARACTER";
            const message = invalidCharacter === "`"
                ? "No se admiten template strings"
                : `Carácter no reconocido: ${invalidCharacter}`;

            this.addDiagnostic(code, message, start, this.position());
        }

        const end = this.position();
        this.addToken(TokenType.EOF, null, end, end, "");

        return {
            ok: this.diagnostics.length === 0,
            value: {
                tokens: this.tokens,
            },
            diagnostics: this.diagnostics,
        };
    }

    scanNewline() {
        const start = this.position();

        if (this.peek() === "\r") {
            this.advance();
            if (this.peek() === "\n") {
                this.offset += 1;
            }
        } else {
            this.advance();
        }

        this.line += 1;
        this.column = 0;
        this.addToken(TokenType.NEWLINE, "\n", start, this.position(), "\n");
    }

    scanLineComment() {
        this.advance();
        this.advance();

        while (!this.isAtEnd() && this.peek() !== "\n" && this.peek() !== "\r") {
            this.advance();
        }
    }

    scanBlockComment() {
        const start = this.position();
        this.advance();
        this.advance();

        while (!this.isAtEnd()) {
            if (this.peek() === "*" && this.peek(1) === "/") {
                this.advance();
                this.advance();
                return;
            }

            if (this.peek() === "\n" || this.peek() === "\r") {
                this.scanNewline();
                continue;
            }

            this.advance();
        }

        this.addDiagnostic(
            "UNTERMINATED_BLOCK_COMMENT",
            "El comentario de bloque no está cerrado",
            start,
            this.position(),
        );
    }

    scanString() {
        const start = this.position();
        const quote = this.advance();
        let value = "";

        while (!this.isAtEnd()) {
            const character = this.peek();

            if (character === quote) {
                this.advance();
                this.addToken(
                    TokenType.STRING,
                    value,
                    start,
                    this.position(),
                    this.source.slice(start.offset, this.offset),
                );
                return;
            }

            if (character === "\n" || character === "\r") {
                this.addDiagnostic(
                    "UNTERMINATED_STRING",
                    "El string no está cerrado",
                    start,
                    this.position(),
                );
                return;
            }

            if (character !== "\\") {
                value += this.advance();
                continue;
            }

            const escapeStart = this.position();
            this.advance();

            if (this.isAtEnd() || this.peek() === "\n" || this.peek() === "\r") {
                this.addDiagnostic(
                    "UNTERMINATED_STRING",
                    "El string no está cerrado",
                    start,
                    this.position(),
                );
                return;
            }

            const escapedCharacter = this.advance();

            if (escapedCharacter === "u") {
                value += this.scanUnicodeEscape(escapeStart);
                continue;
            }

            if (Object.prototype.hasOwnProperty.call(ESCAPE_VALUES, escapedCharacter)) {
                value += ESCAPE_VALUES[escapedCharacter];
                continue;
            }

            this.addDiagnostic(
                "INVALID_ESCAPE_SEQUENCE",
                `Secuencia de escape inválida: \\${escapedCharacter}`,
                escapeStart,
                this.position(),
            );
            value += escapedCharacter;
        }

        this.addDiagnostic(
            "UNTERMINATED_STRING",
            "El string no está cerrado",
            start,
            this.position(),
        );
    }

    scanUnicodeEscape(start) {
        let hexadecimal = "";

        for (let index = 0; index < 4; index += 1) {
            const character = this.peek();

            if (!character || !HEX_DIGIT.test(character)) {
                this.addDiagnostic(
                    "INVALID_UNICODE_ESCAPE",
                    "Una secuencia Unicode debe contener cuatro dígitos hexadecimales",
                    start,
                    this.position(),
                );
                return "";
            }

            hexadecimal += this.advance();
        }

        return String.fromCharCode(Number.parseInt(hexadecimal, 16));
    }

    scanNumber() {
        const start = this.position();

        while (DIGIT.test(this.peek())) {
            this.advance();
        }

        if (this.peek() === "." && DIGIT.test(this.peek(1))) {
            this.advance();
            while (DIGIT.test(this.peek())) {
                this.advance();
            }
        }

        const raw = this.source.slice(start.offset, this.offset);
        this.addToken(TokenType.NUMBER, Number(raw), start, this.position(), raw);
    }

    scanIdentifier() {
        const start = this.position();

        while (IDENTIFIER_PART.test(this.peek())) {
            this.advance();
        }

        const value = this.source.slice(start.offset, this.offset);
        const type = KeywordTokenTypes[value] ?? TokenType.IDENTIFIER;
        this.addToken(type, value, start, this.position(), value);
    }

    scanOperator() {
        const start = this.position();

        for (const supported of ["===", "!=="]) {
            if (!this.source.startsWith(supported, this.offset)) {
                continue;
            }

            for (let index = 0; index < supported.length; index += 1) {
                this.advance();
            }

            this.addToken(OperatorTokenTypes[supported], supported, start, this.position(), supported);
            return true;
        }

        for (const unsupported of ["==", "!="]) {
            if (!this.source.startsWith(unsupported, this.offset)) {
                continue;
            }

            this.advance();
            this.advance();
            this.addDiagnostic(
                "UNSUPPORTED_OPERATOR",
                `El operador ${unsupported} no está permitido; utiliza ${unsupported}=`,
                start,
                this.position(),
            );
            return true;
        }

        for (const lexeme of OperatorLexemes) {
            if (lexeme === "===" || lexeme === "!==") {
                continue;
            }

            if (!this.source.startsWith(lexeme, this.offset)) {
                continue;
            }

            for (let index = 0; index < lexeme.length; index += 1) {
                this.advance();
            }

            this.addToken(OperatorTokenTypes[lexeme], lexeme, start, this.position(), lexeme);
            return true;
        }

        return false;
    }

    addToken(type, value, start, end, raw) {
        this.tokens.push({
            type,
            value,
            raw,
            loc: CreateLocation(start, end),
        });
    }

    addDiagnostic(code, message, start, end) {
        this.diagnostics.push(
            CreateDiagnostic("tokenizer", code, message, start, end),
        );
    }

    position() {
        return CreatePosition(this.line, this.column, this.offset);
    }

    peek(distance = 0) {
        return this.source[this.offset + distance] ?? "";
    }

    advance() {
        const character = this.peek();
        this.offset += 1;
        this.column += 1;
        return character;
    }

    isAtEnd() {
        return this.offset >= this.source.length;
    }
}

const Tokenize = (source) => {
    if (typeof source !== "string") {
        const origin = CreatePosition(1, 0, 0);
        return {
            ok: false,
            value: {
                tokens: [],
            },
            diagnostics: [
                CreateDiagnostic(
                    "tokenizer",
                    "INVALID_SOURCE",
                    "El código fuente debe ser un string",
                    origin,
                    origin,
                ),
            ],
        };
    }

    return new Tokenizer(source).tokenize();
};

module.exports = {
    Tokenizer,
    Tokenize,
};
