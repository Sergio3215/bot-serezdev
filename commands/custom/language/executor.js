const Ast = require("./ast.js");
const { NativeCallExpression } = require("./compiler.js");
const { CreateDiagnostic } = require("./diagnostics.js");

const ExecutionLimits = Object.freeze({
    maxInstructions: 1000,
    maxIterations: 1000,
    maxDepth: 64,
    maxNativeCalls: 100,
    maxExecutionMs: 5000,
});

const BREAK_SIGNAL = Symbol("break");
const CONTINUE_SIGNAL = Symbol("continue");

class CustomCommandRuntimeError extends Error {
    constructor(code, message, loc, phase = "runtime") {
        super(message);
        this.name = "CustomCommandRuntimeError";
        this.code = code;
        this.loc = loc;
        this.phase = phase;
    }
}

class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.bindings = new Map();
    }

    define(name, value, mutable, loc) {
        if (this.bindings.has(name)) {
            throw new CustomCommandRuntimeError(
                "DUPLICATE_BINDING",
                `La variable ${name} ya existe en este bloque`,
                loc,
            );
        }

        this.bindings.set(name, { value, mutable });
    }

    resolve(name, loc) {
        if (this.bindings.has(name)) {
            return this.bindings.get(name);
        }

        if (this.parent) {
            return this.parent.resolve(name, loc);
        }

        throw new CustomCommandRuntimeError(
            "UNDEFINED_IDENTIFIER",
            `El identificador ${name} no está definido`,
            loc,
        );
    }

    get(name, loc) {
        return this.resolve(name, loc).value;
    }

    assign(name, value, loc) {
        const binding = this.resolve(name, loc);
        if (!binding.mutable) {
            throw new CustomCommandRuntimeError(
                "CONST_REASSIGNMENT",
                `No se puede reasignar la constante ${name}`,
                loc,
            );
        }

        binding.value = value;
        return value;
    }
}

class Executor {
    constructor(runtimeContext, limits = {}) {
        this.runtimeContext = runtimeContext;
        this.limits = Object.freeze({ ...ExecutionLimits, ...limits });
        this.startedAt = Date.now();
        this.instructions = 0;
        this.iterations = 0;
        this.nativeCalls = 0;
        this.depth = 0;
    }

    async execute(instructions) {
        const environment = new Environment();

        try {
            for (const instruction of instructions) {
                const signal = await this.executeStatement(instruction, environment);
                if (signal === BREAK_SIGNAL || signal === CONTINUE_SIGNAL) {
                    throw new CustomCommandRuntimeError(
                        "INVALID_LOOP_CONTROL",
                        "break o continue apareció fuera de un bucle",
                        instruction.loc,
                    );
                }
            }

            return {
                ok: true,
                value: undefined,
                diagnostics: [],
            };
        } catch (error) {
            const runtimeError = error instanceof CustomCommandRuntimeError
                ? error
                : new CustomCommandRuntimeError(
                    "UNEXPECTED_RUNTIME_ERROR",
                    error?.message ?? "Error inesperado durante la ejecución",
                    this.defaultLocation(),
                );

            return {
                ok: false,
                value: undefined,
                diagnostics: [
                    CreateDiagnostic(
                        runtimeError.phase,
                        runtimeError.code,
                        runtimeError.message,
                        runtimeError.loc.start,
                        runtimeError.loc.end,
                    ),
                ],
            };
        }
    }

    async executeStatement(node, environment) {
        this.countInstruction(node);

        switch (node.type) {
            case Ast.NodeType.BLOCK_STATEMENT:
                return this.withDepth(node, async () => {
                    const blockEnvironment = new Environment(environment);
                    for (const statement of node.body) {
                        const signal = await this.executeStatement(statement, blockEnvironment);
                        if (signal) return signal;
                    }
                    return null;
                });

            case Ast.NodeType.EXPRESSION_STATEMENT:
                await this.evaluate(node.expression, environment);
                return null;

            case Ast.NodeType.VARIABLE_DECLARATION:
                for (const declaration of node.declarations) {
                    const value = declaration.init === null
                        ? undefined
                        : await this.evaluate(declaration.init, environment);
                    environment.define(
                        declaration.id.name,
                        value,
                        node.kind === "let",
                        declaration.loc,
                    );
                }
                return null;

            case Ast.NodeType.IF_STATEMENT:
                if (await this.evaluate(node.test, environment)) {
                    return this.executeStatement(node.consequent, environment);
                }
                if (node.alternate) {
                    return this.executeStatement(node.alternate, environment);
                }
                return null;

            case Ast.NodeType.FOR_OF_STATEMENT:
                return this.executeForOf(node, environment);

            case Ast.NodeType.BREAK_STATEMENT:
                return BREAK_SIGNAL;

            case Ast.NodeType.CONTINUE_STATEMENT:
                return CONTINUE_SIGNAL;

            default:
                throw new CustomCommandRuntimeError(
                    "UNKNOWN_INSTRUCTION",
                    `Instrucción no soportada: ${node.type}`,
                    node.loc,
                );
        }
    }

    async executeForOf(node, environment) {
        const iterable = await this.evaluate(node.right, environment);
        if (!Array.isArray(iterable)) {
            throw new CustomCommandRuntimeError(
                "NOT_ITERABLE",
                "for...of requiere un array",
                node.right.loc,
            );
        }

        const declaration = node.left.declarations[0];

        for (const value of iterable) {
            this.iterations += 1;
            this.checkLimit("maxIterations", this.iterations, node.loc, "ITERATION_LIMIT");
            const iterationEnvironment = new Environment(environment);
            iterationEnvironment.define(
                declaration.id.name,
                value,
                node.left.kind === "let",
                declaration.loc,
            );

            const signal = await this.executeStatement(node.body, iterationEnvironment);
            if (signal === BREAK_SIGNAL) break;
            if (signal === CONTINUE_SIGNAL) continue;
        }

        return null;
    }

    async evaluate(node, environment) {
        return this.withDepth(node, async () => {
            this.checkTime(node.loc);

            switch (node.type) {
                case Ast.NodeType.STRING_LITERAL:
                case Ast.NodeType.NUMBER_LITERAL:
                case Ast.NodeType.BOOLEAN_LITERAL:
                case Ast.NodeType.NULL_LITERAL:
                    return node.value;

                case Ast.NodeType.IDENTIFIER:
                    return environment.get(node.name, node.loc);

                case NativeCallExpression:
                    return this.evaluateNativeCall(node, environment);

                case Ast.NodeType.OBJECT_EXPRESSION:
                    return this.evaluateObject(node, environment);

                case Ast.NodeType.ARRAY_EXPRESSION:
                    return this.evaluateArray(node, environment);

                case Ast.NodeType.MEMBER_EXPRESSION:
                    return this.getMemberValue(node, environment);

                case Ast.NodeType.BINARY_EXPRESSION:
                    return this.evaluateBinary(node, environment);

                case Ast.NodeType.LOGICAL_EXPRESSION:
                    return this.evaluateLogical(node, environment);

                case Ast.NodeType.UNARY_EXPRESSION:
                    return this.evaluateUnary(node, environment);

                case Ast.NodeType.ASSIGNMENT_EXPRESSION:
                    return this.evaluateAssignment(node, environment);

                case Ast.NodeType.UPDATE_EXPRESSION:
                    return this.evaluateUpdate(node, environment);

                default:
                    throw new CustomCommandRuntimeError(
                        "UNKNOWN_EXPRESSION",
                        `Expresión no soportada: ${node.type}`,
                        node.loc,
                    );
            }
        });
    }

    async evaluateNativeCall(node, environment) {
        if (!node.nativeEntry) {
            throw new CustomCommandRuntimeError(
                "UNRESOLVED_NATIVE_CALL",
                `La llamada ${node.nativeName} no fue resuelta`,
                node.loc,
            );
        }

        this.nativeCalls += 1;
        this.checkLimit("maxNativeCalls", this.nativeCalls, node.loc, "NATIVE_CALL_LIMIT");

        const args = [];
        for (const argument of node.arguments) {
            args.push(await this.evaluate(argument, environment));
        }

        try {
            return await this.withRemainingTime(
                Promise.resolve(node.nativeEntry.execute(this.runtimeContext, args)),
                node.loc,
            );
        } catch (error) {
            if (error instanceof CustomCommandRuntimeError) throw error;
            throw new CustomCommandRuntimeError(
                "NATIVE_EXECUTION_ERROR",
                `${node.nativeName}: ${error?.message ?? "la operación nativa falló"}`,
                node.loc,
                "native",
            );
        }
    }

    async evaluateObject(node, environment) {
        const result = {};
        for (const property of node.properties) {
            result[property.key.name] = await this.evaluate(property.value, environment);
        }
        return result;
    }

    async evaluateArray(node, environment) {
        const result = [];
        for (const element of node.elements) {
            result.push(await this.evaluate(element, environment));
        }
        return result;
    }

    async getMemberValue(node, environment) {
        const object = await this.evaluate(node.object, environment);
        if (object === null || object === undefined) {
            throw new CustomCommandRuntimeError(
                "NULL_MEMBER_ACCESS",
                "No se puede acceder a una propiedad de null",
                node.loc,
            );
        }

        const property = node.computed
            ? await this.evaluate(node.property, environment)
            : node.property.name;
        return object[property];
    }

    async evaluateBinary(node, environment) {
        const left = await this.evaluate(node.left, environment);
        const right = await this.evaluate(node.right, environment);

        switch (node.operator) {
            case "+": return left + right;
            case "-": return left - right;
            case "*": return left * right;
            case "/": return left / right;
            case "%": return left % right;
            case "===": return left === right;
            case "!==": return left !== right;
            case "<": return left < right;
            case "<=": return left <= right;
            case ">": return left > right;
            case ">=": return left >= right;
            default:
                throw new CustomCommandRuntimeError(
                    "UNKNOWN_OPERATOR",
                    `Operador no soportado: ${node.operator}`,
                    node.loc,
                );
        }
    }

    async evaluateLogical(node, environment) {
        const left = await this.evaluate(node.left, environment);
        if (node.operator === "&&") {
            return left && await this.evaluate(node.right, environment);
        }
        if (node.operator === "||") {
            return left || await this.evaluate(node.right, environment);
        }
        throw new CustomCommandRuntimeError(
            "UNKNOWN_OPERATOR",
            `Operador no soportado: ${node.operator}`,
            node.loc,
        );
    }

    async evaluateUnary(node, environment) {
        const value = await this.evaluate(node.argument, environment);
        switch (node.operator) {
            case "!": return !value;
            case "+": return +value;
            case "-": return -value;
            default:
                throw new CustomCommandRuntimeError(
                    "UNKNOWN_OPERATOR",
                    `Operador no soportado: ${node.operator}`,
                    node.loc,
                );
        }
    }

    async evaluateAssignment(node, environment) {
        const current = node.operator === "="
            ? undefined
            : await this.readTarget(node.left, environment);
        const right = await this.evaluate(node.right, environment);
        let value;

        if (node.operator === "=") value = right;
        else if (node.operator === "+=") value = current + right;
        else if (node.operator === "-=") value = current - right;
        else {
            throw new CustomCommandRuntimeError(
                "UNKNOWN_OPERATOR",
                `Operador no soportado: ${node.operator}`,
                node.loc,
            );
        }

        await this.writeTarget(node.left, value, environment);
        return value;
    }

    async evaluateUpdate(node, environment) {
        const previous = await this.readTarget(node.argument, environment);
        const next = node.operator === "++" ? previous + 1 : previous - 1;
        await this.writeTarget(node.argument, next, environment);
        return node.prefix ? next : previous;
    }

    async readTarget(node, environment) {
        if (node.type === Ast.NodeType.IDENTIFIER) {
            return environment.get(node.name, node.loc);
        }
        return this.getMemberValue(node, environment);
    }

    async writeTarget(node, value, environment) {
        if (node.type === Ast.NodeType.IDENTIFIER) {
            return environment.assign(node.name, value, node.loc);
        }

        const object = await this.evaluate(node.object, environment);
        if (object === null || object === undefined || Object.isFrozen(object)) {
            throw new CustomCommandRuntimeError(
                "READ_ONLY_VALUE",
                "No se puede modificar este valor",
                node.loc,
            );
        }

        const property = node.computed
            ? await this.evaluate(node.property, environment)
            : node.property.name;
        object[property] = value;
        return value;
    }

    countInstruction(node) {
        this.instructions += 1;
        this.checkLimit("maxInstructions", this.instructions, node.loc, "INSTRUCTION_LIMIT");
        this.checkTime(node.loc);
    }

    checkLimit(limitName, current, loc, code) {
        if (current > this.limits[limitName]) {
            throw new CustomCommandRuntimeError(
                code,
                `Se superó el límite ${limitName}`,
                loc,
            );
        }
    }

    checkTime(loc) {
        if (Date.now() - this.startedAt > this.limits.maxExecutionMs) {
            throw new CustomCommandRuntimeError(
                "EXECUTION_TIMEOUT",
                "El comando superó el tiempo máximo de ejecución",
                loc,
            );
        }
    }

    async withDepth(node, callback) {
        this.depth += 1;
        try {
            this.checkLimit("maxDepth", this.depth, node.loc, "DEPTH_LIMIT");
            return await callback();
        } finally {
            this.depth -= 1;
        }
    }

    async withRemainingTime(promise, loc) {
        const remaining = this.limits.maxExecutionMs - (Date.now() - this.startedAt);
        if (remaining <= 0) {
            this.checkTime(loc);
        }

        let timeout;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timeout = setTimeout(() => reject(new CustomCommandRuntimeError(
                        "EXECUTION_TIMEOUT",
                        "El comando superó el tiempo máximo de ejecución",
                        loc,
                    )), remaining);
                }),
            ]);
        } finally {
            clearTimeout(timeout);
        }
    }

    defaultLocation() {
        const position = { line: 1, column: 0, offset: 0 };
        return { start: position, end: position };
    }
}

const Execute = (compiledInstructions, runtimeContext, limits) => {
    if (!Array.isArray(compiledInstructions)) {
        const position = { line: 1, column: 0, offset: 0 };
        return Promise.resolve({
            ok: false,
            value: undefined,
            diagnostics: [
                CreateDiagnostic(
                    "runtime",
                    "INVALID_PROGRAM",
                    "El executor requiere una lista de instrucciones compiladas",
                    position,
                    position,
                ),
            ],
        });
    }

    return new Executor(runtimeContext, limits).execute(compiledInstructions);
};

module.exports = {
    ExecutionLimits,
    CustomCommandRuntimeError,
    Environment,
    Executor,
    Execute,
};
