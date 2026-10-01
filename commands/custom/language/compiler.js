const Ast = require("./ast.js");
const { Tokenize } = require("./tokenizer.js");
const { Parse } = require("./parser.js");
const { Validate } = require("./semanticValidator.js");
const { CreateDiagnostic } = require("./diagnostics.js");
const { DeepFreeze } = require("./native/types.js");
const { nativeRegistry: DefaultNativeRegistry } = require("./native/index.js");

const NativeCallExpression = "NativeCallExpression";

class Compiler {
    constructor(ast, analysis, commandMetadata) {
        this.ast = ast;
        this.analysis = analysis;
        this.commandMetadata = commandMetadata;
        this.diagnostics = [];
        this.requirements = new Set();
    }

    compile() {
        const instructions = this.ast.body.map((statement) => this.compileStatement(statement));
        const program = DeepFreeze({
            commandId: this.commandMetadata.id ?? null,
            serverId: this.commandMetadata.serverId ?? null,
            requirements: Array.from(this.requirements),
            instructions,
        });

        return {
            ok: this.diagnostics.length === 0,
            value: { program },
            diagnostics: this.diagnostics,
        };
    }

    compileStatement(node) {
        switch (node.type) {
            case Ast.NodeType.BLOCK_STATEMENT:
                return this.copy(node, {
                    body: node.body.map((statement) => this.compileStatement(statement)),
                });
            case Ast.NodeType.EXPRESSION_STATEMENT:
                return this.copy(node, { expression: this.compileExpression(node.expression) });
            case Ast.NodeType.VARIABLE_DECLARATION:
                return this.copy(node, {
                    kind: node.kind,
                    declarations: node.declarations.map((declaration) => this.copy(declaration, {
                        id: this.compileExpression(declaration.id),
                        init: declaration.init === null ? null : this.compileExpression(declaration.init),
                    })),
                });
            case Ast.NodeType.IF_STATEMENT:
                return this.copy(node, {
                    test: this.compileExpression(node.test),
                    consequent: this.compileStatement(node.consequent),
                    alternate: node.alternate === null ? null : this.compileStatement(node.alternate),
                });
            case Ast.NodeType.FOR_OF_STATEMENT:
                return this.copy(node, {
                    left: this.compileStatement(node.left),
                    right: this.compileExpression(node.right),
                    body: this.compileStatement(node.body),
                });
            case Ast.NodeType.BREAK_STATEMENT:
            case Ast.NodeType.CONTINUE_STATEMENT:
                return this.copy(node);
            default:
                this.report(node, "UNKNOWN_STATEMENT", `No se puede compilar ${node.type}`);
                return this.copy(node);
        }
    }

    compileExpression(node) {
        switch (node.type) {
            case Ast.NodeType.IDENTIFIER:
                return this.copy(node, { name: node.name });
            case Ast.NodeType.STRING_LITERAL:
            case Ast.NodeType.NUMBER_LITERAL:
            case Ast.NodeType.BOOLEAN_LITERAL:
            case Ast.NodeType.NULL_LITERAL:
                return this.copy(node, { value: node.value });
            case Ast.NodeType.CALL_EXPRESSION:
                return this.compileCallExpression(node);
            case Ast.NodeType.OBJECT_EXPRESSION:
                return this.copy(node, {
                    properties: node.properties.map((property) => this.copy(property, {
                        key: this.compileExpression(property.key),
                        value: this.compileExpression(property.value),
                    })),
                });
            case Ast.NodeType.ARRAY_EXPRESSION:
                return this.copy(node, {
                    elements: node.elements.map((element) => this.compileExpression(element)),
                });
            case Ast.NodeType.MEMBER_EXPRESSION:
                return this.copy(node, {
                    object: this.compileExpression(node.object),
                    property: this.compileExpression(node.property),
                    computed: node.computed,
                });
            case Ast.NodeType.BINARY_EXPRESSION:
            case Ast.NodeType.LOGICAL_EXPRESSION:
            case Ast.NodeType.ASSIGNMENT_EXPRESSION:
                return this.copy(node, {
                    operator: node.operator,
                    left: this.compileExpression(node.left),
                    right: this.compileExpression(node.right),
                });
            case Ast.NodeType.UNARY_EXPRESSION:
            case Ast.NodeType.UPDATE_EXPRESSION:
                return this.copy(node, {
                    operator: node.operator,
                    argument: this.compileExpression(node.argument),
                    prefix: node.prefix,
                });
            default:
                this.report(node, "UNKNOWN_EXPRESSION", `No se puede compilar ${node.type}`);
                return this.copy(node);
        }
    }

    compileCallExpression(node) {
        const nativeEntry = this.analysis.nativeCalls.get(node);

        if (!nativeEntry) {
            this.report(
                node,
                "UNRESOLVED_NATIVE_CALL",
                `No se pudo resolver la llamada ${node.callee.name}`,
            );
        }

        for (const requirement of nativeEntry?.metadata.requires ?? []) {
            this.requirements.add(requirement);
        }

        return {
            type: NativeCallExpression,
            nativeName: node.callee.name,
            nativeEntry: nativeEntry ?? null,
            arguments: node.arguments.map((argument) => this.compileExpression(argument)),
            loc: Ast.CloneLocation(node.loc),
        };
    }

    copy(node, properties = {}) {
        return {
            type: node.type,
            ...properties,
            loc: Ast.CloneLocation(node.loc),
        };
    }

    report(node, code, message) {
        this.diagnostics.push(
            CreateDiagnostic("compiler", code, message, node.loc.start, node.loc.end),
        );
    }
}

const Compile = (ast, analysis, commandMetadata = {}) => {
    if (!ast || !analysis) {
        const origin = { line: 1, column: 0, offset: 0 };
        return {
            ok: false,
            value: { program: null },
            diagnostics: [
                CreateDiagnostic(
                    "compiler",
                    "INVALID_COMPILER_INPUT",
                    "El compilador requiere un AST validado",
                    origin,
                    origin,
                ),
            ],
        };
    }

    return new Compiler(ast, analysis, commandMetadata).compile();
};

const CompileCustomCommand = (
    customCommand,
    nativeRegistry = DefaultNativeRegistry,
) => {
    const tokenized = Tokenize(customCommand?.code);
    if (!tokenized.ok) return { ok: false, value: { compiledCommand: null }, diagnostics: tokenized.diagnostics };

    const parsed = Parse(tokenized.value.tokens);
    if (!parsed.ok) return { ok: false, value: { compiledCommand: null }, diagnostics: parsed.diagnostics };

    const validated = Validate(parsed.value.ast, nativeRegistry);
    if (!validated.ok) return { ok: false, value: { compiledCommand: null }, diagnostics: validated.diagnostics };

    const compiled = Compile(
        parsed.value.ast,
        validated.value.analysis,
        customCommand,
    );
    if (!compiled.ok) return { ok: false, value: { compiledCommand: null }, diagnostics: compiled.diagnostics };

    const compiledCommand = DeepFreeze({
        id: customCommand.id,
        serverId: customCommand.serverId,
        command: customCommand.command,
        updatedAt: customCommand.updatedAt,
        program: compiled.value.program,
    });

    return {
        ok: true,
        value: { compiledCommand },
        diagnostics: [],
    };
};

module.exports = {
    NativeCallExpression,
    Compiler,
    Compile,
    CompileCustomCommand,
};
