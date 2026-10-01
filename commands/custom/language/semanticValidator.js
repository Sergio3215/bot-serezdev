const Ast = require("./ast.js");
const { CreateDiagnostic } = require("./diagnostics.js");
const {
    TypeKind,
    NativeTypes,
    ArrayOf,
    UnionOf,
    FormatType,
} = require("./native/types.js");

const UnknownType = Object.freeze({
    kind: "unknown",
    name: "Unknown",
});

class Scope {
    constructor(parent = null, narrowings = new Map()) {
        this.parent = parent;
        this.bindings = new Map();
        this.narrowings = narrowings;
    }

    find(name) {
        let scope = this;

        while (scope) {
            if (scope.bindings.has(name)) {
                const binding = scope.bindings.get(name);
                return { binding, type: binding.type };
            }

            if (scope.narrowings.has(name)) {
                const binding = scope.findBindingInParents(name);
                return binding ? { binding, type: scope.narrowings.get(name) } : null;
            }

            scope = scope.parent;
        }

        return null;
    }

    findBindingInParents(name) {
        let scope = this.parent;
        while (scope) {
            if (scope.bindings.has(name)) {
                return scope.bindings.get(name);
            }
            scope = scope.parent;
        }
        return null;
    }
}

const IsUnknown = (type) => type === UnknownType || type?.kind === "unknown";
const IsNamedType = (type, name) => type?.name === name;

const IsNullable = (type) =>
    type?.kind === TypeKind.UNION
    && type.types.some((memberType) => IsNamedType(memberType, "Null"));

const WithoutNull = (type) => {
    if (!IsNullable(type)) {
        return type;
    }

    const remaining = type.types.filter((memberType) => !IsNamedType(memberType, "Null"));
    return remaining.length === 1 ? remaining[0] : UnionOf(...remaining);
};

const IsAssignable = (actual, expected) => {
    if (IsUnknown(actual) || IsUnknown(expected)) {
        return true;
    }

    if (expected.kind === TypeKind.UNION) {
        return expected.types.some((type) => IsAssignable(actual, type));
    }

    if (actual.kind === TypeKind.UNION) {
        return actual.types.every((type) => IsAssignable(type, expected));
    }

    if (actual.kind === TypeKind.ARRAY && expected.kind === TypeKind.ARRAY) {
        return IsAssignable(actual.elementType, expected.elementType);
    }

    if (actual.kind === TypeKind.OBJECT && expected.kind === TypeKind.OBJECT) {
        return actual.name === expected.name;
    }

    return actual.name === expected.name;
};

class SemanticValidator {
    constructor(ast, nativeRegistry) {
        this.ast = ast;
        this.nativeRegistry = nativeRegistry;
        this.diagnostics = [];
        this.expressionTypes = new Map();
        this.nativeCalls = new Map();
        this.scopes = [];
        this.currentScope = null;
        this.loopDepth = 0;
    }

    validate() {
        this.withScope(() => {
            for (const statement of this.ast.body) {
                this.validateStatement(statement);
            }
        });

        return {
            ok: this.diagnostics.length === 0,
            value: {
                ast: this.ast,
                analysis: {
                    expressionTypes: this.expressionTypes,
                    nativeCalls: this.nativeCalls,
                    scopes: this.scopes,
                },
            },
            diagnostics: this.diagnostics,
        };
    }

    validateStatement(node) {
        switch (node.type) {
            case Ast.NodeType.BLOCK_STATEMENT:
                this.withScope(() => {
                    for (const statement of node.body) {
                        this.validateStatement(statement);
                    }
                });
                return;

            case Ast.NodeType.EXPRESSION_STATEMENT:
                this.inferExpression(node.expression);
                return;

            case Ast.NodeType.VARIABLE_DECLARATION:
                this.validateVariableDeclaration(node, false);
                return;

            case Ast.NodeType.IF_STATEMENT:
                this.validateIfStatement(node);
                return;

            case Ast.NodeType.FOR_OF_STATEMENT:
                this.validateForOfStatement(node);
                return;

            case Ast.NodeType.BREAK_STATEMENT:
            case Ast.NodeType.CONTINUE_STATEMENT:
                if (this.loopDepth === 0) {
                    this.report(
                        node,
                        "INVALID_LOOP_CONTROL",
                        `${node.type === Ast.NodeType.BREAK_STATEMENT ? "break" : "continue"} solo puede utilizarse dentro de for...of`,
                    );
                }
                return;

            default:
                this.report(node, "UNKNOWN_STATEMENT", `Instrucción desconocida: ${node.type}`);
        }
    }

    validateVariableDeclaration(node, allowMissingInitializer) {
        if (node.kind !== "let" && node.kind !== "const") {
            this.report(node, "INVALID_VARIABLE_KIND", "Las variables deben declararse con let o const");
        }

        if (node.declarations.length === 0) {
            this.report(node, "EMPTY_VARIABLE_DECLARATION", "La declaración no contiene variables");
        }

        for (const declaration of node.declarations) {
            const name = declaration.id.name;

            if (this.currentScope.bindings.has(name)) {
                this.report(
                    declaration.id,
                    "DUPLICATE_DECLARATION",
                    `La variable ${name} ya fue declarada en este bloque`,
                );
                continue;
            }

            if (declaration.init === null && !allowMissingInitializer) {
                this.report(
                    declaration,
                    "MISSING_INITIALIZER",
                    `La variable ${name} requiere un valor inicial`,
                );
            }

            const type = declaration.init === null
                ? UnknownType
                : this.inferExpression(declaration.init);

            this.currentScope.bindings.set(name, {
                name,
                kind: node.kind,
                mutable: node.kind === "let",
                type,
                declaration,
            });
        }
    }

    validateIfStatement(node) {
        this.inferExpression(node.test);
        const narrowing = this.getNullNarrowing(node.test);
        const consequentNarrowings = new Map();
        const alternateNarrowings = new Map();

        if (narrowing) {
            if (narrowing.nonNullWhenTrue) {
                consequentNarrowings.set(narrowing.name, narrowing.nonNullType);
                alternateNarrowings.set(narrowing.name, NativeTypes.Null);
            } else {
                consequentNarrowings.set(narrowing.name, NativeTypes.Null);
                alternateNarrowings.set(narrowing.name, narrowing.nonNullType);
            }
        }

        this.withScope(() => this.validateStatement(node.consequent), consequentNarrowings);

        if (node.alternate) {
            this.withScope(() => this.validateStatement(node.alternate), alternateNarrowings);
        }
    }

    validateForOfStatement(node) {
        const iterableType = this.inferExpression(node.right);

        if (!IsUnknown(iterableType) && iterableType.kind !== TypeKind.ARRAY) {
            this.report(node.right, "NOT_ITERABLE", "for...of requiere un array");
        }

        if (node.left.declarations.length !== 1) {
            this.report(
                node.left,
                "INVALID_FOR_OF_DECLARATION",
                "for...of requiere exactamente una variable",
            );
        }

        const elementType = iterableType.kind === TypeKind.ARRAY
            ? iterableType.elementType
            : UnknownType;

        this.withScope(() => {
            const declaration = node.left.declarations[0];
            this.currentScope.bindings.set(declaration.id.name, {
                name: declaration.id.name,
                kind: node.left.kind,
                mutable: node.left.kind === "let",
                type: elementType,
                declaration,
            });

            this.loopDepth += 1;
            this.validateStatement(node.body);
            this.loopDepth -= 1;
        });
    }

    inferExpression(node) {
        let type;

        switch (node.type) {
            case Ast.NodeType.STRING_LITERAL:
                type = NativeTypes.String;
                break;
            case Ast.NodeType.NUMBER_LITERAL:
                type = NativeTypes.Number;
                break;
            case Ast.NodeType.BOOLEAN_LITERAL:
                type = NativeTypes.Boolean;
                break;
            case Ast.NodeType.NULL_LITERAL:
                type = NativeTypes.Null;
                break;
            case Ast.NodeType.IDENTIFIER:
                type = this.inferIdentifier(node);
                break;
            case Ast.NodeType.CALL_EXPRESSION:
                type = this.inferCallExpression(node);
                break;
            case Ast.NodeType.OBJECT_EXPRESSION:
                type = this.inferObjectExpression(node);
                break;
            case Ast.NodeType.ARRAY_EXPRESSION:
                type = this.inferArrayExpression(node);
                break;
            case Ast.NodeType.MEMBER_EXPRESSION:
                type = this.inferMemberExpression(node);
                break;
            case Ast.NodeType.BINARY_EXPRESSION:
                type = this.inferBinaryExpression(node);
                break;
            case Ast.NodeType.LOGICAL_EXPRESSION:
                type = this.inferLogicalExpression(node);
                break;
            case Ast.NodeType.UNARY_EXPRESSION:
                type = this.inferUnaryExpression(node);
                break;
            case Ast.NodeType.ASSIGNMENT_EXPRESSION:
                type = this.inferAssignmentExpression(node);
                break;
            case Ast.NodeType.UPDATE_EXPRESSION:
                type = this.inferUpdateExpression(node);
                break;
            default:
                this.report(node, "UNKNOWN_EXPRESSION", `Expresión desconocida: ${node.type}`);
                type = UnknownType;
        }

        this.expressionTypes.set(node, type);
        return type;
    }

    inferIdentifier(node) {
        const resolved = this.currentScope.find(node.name);

        if (!resolved) {
            this.report(node, "UNDEFINED_IDENTIFIER", `El identificador ${node.name} no está declarado`);
            return UnknownType;
        }

        return resolved.type;
    }

    inferCallExpression(node) {
        const entry = this.nativeRegistry.get(node.callee.name);

        if (!entry) {
            this.report(
                node.callee,
                "UNKNOWN_NATIVE_FUNCTION",
                `La función nativa ${node.callee.name} no existe`,
            );
            for (const argument of node.arguments) this.inferExpression(argument);
            return UnknownType;
        }

        if (!entry.metadata.contexts.includes("message")) {
            this.report(
                node,
                "INVALID_NATIVE_CONTEXT",
                `${entry.metadata.name} no puede utilizarse desde messageCreate`,
            );
        }

        const requiredCount = entry.metadata.parameters.filter((parameter) => parameter.required).length;
        if (node.arguments.length < requiredCount || node.arguments.length > entry.metadata.parameters.length) {
            this.report(
                node,
                "INVALID_ARGUMENT_COUNT",
                `${entry.metadata.name} recibió ${node.arguments.length} argumentos y espera ${requiredCount}`,
            );
        }

        node.arguments.forEach((argument, index) => {
            const actualType = this.inferExpression(argument);
            const parameter = entry.metadata.parameters[index];
            if (parameter) {
                this.validateValueAgainstType(argument, actualType, parameter.type, parameter.name);
                this.validateLiteralConstraints(argument, parameter, parameter.name);
            }
        });

        this.nativeCalls.set(node, entry);
        return entry.metadata.returns.nullable
            ? UnionOf(entry.metadata.returns.type, NativeTypes.Null)
            : entry.metadata.returns.type;
    }

    inferObjectExpression(node) {
        const properties = {};

        for (const property of node.properties) {
            const name = property.key.name;
            if (Object.prototype.hasOwnProperty.call(properties, name)) {
                this.report(property.key, "DUPLICATE_PROPERTY", `La propiedad ${name} está duplicada`);
            }

            properties[name] = {
                type: this.inferExpression(property.value),
                required: true,
                readOnly: false,
                node: property.value,
            };
        }

        return {
            kind: TypeKind.OBJECT,
            name: "ObjectLiteral",
            properties,
            readOnly: false,
            additionalProperties: true,
        };
    }

    inferArrayExpression(node) {
        const elementTypes = node.elements.map((element) => this.inferExpression(element));
        let elementType = UnknownType;

        if (elementTypes.length > 0) {
            elementType = elementTypes[0];
            for (const current of elementTypes.slice(1)) {
                if (!IsAssignable(current, elementType) || !IsAssignable(elementType, current)) {
                    elementType = UnknownType;
                    break;
                }
            }
        }

        return ArrayOf(elementType);
    }

    inferMemberExpression(node) {
        let objectType = this.inferExpression(node.object);

        if (IsNullable(objectType)) {
            this.report(
                node.object,
                "NULLABLE_MEMBER_ACCESS",
                "Debe descartarse null antes de acceder a una propiedad",
            );
            objectType = WithoutNull(objectType);
        }

        if (objectType.kind === TypeKind.ARRAY) {
            if (!node.computed) {
                this.report(node, "UNKNOWN_PROPERTY", "Los arrays solo admiten acceso mediante índice");
                return UnknownType;
            }

            const indexType = this.inferExpression(node.property);
            if (!IsUnknown(indexType) && !IsNamedType(indexType, "Number")) {
                this.report(node.property, "INVALID_ARRAY_INDEX", "El índice de un array debe ser Number");
            }
            return objectType.elementType;
        }

        if (objectType.kind !== TypeKind.OBJECT) {
            this.report(node.object, "INVALID_MEMBER_ACCESS", "El valor no expone propiedades");
            return UnknownType;
        }

        const propertyName = this.getStaticPropertyName(node);
        if (propertyName === null) {
            this.inferExpression(node.property);
            return UnknownType;
        }

        const property = objectType.properties[propertyName];
        if (!property) {
            this.report(node.property, "UNKNOWN_PROPERTY", `La propiedad ${propertyName} no existe`);
            return UnknownType;
        }

        return property.type;
    }

    inferBinaryExpression(node) {
        const left = this.inferExpression(node.left);
        const right = this.inferExpression(node.right);

        if (node.operator === "===" || node.operator === "!==") {
            return NativeTypes.Boolean;
        }

        if (["<", "<=", ">", ">="].includes(node.operator)) {
            if (!this.areComparable(left, right)) {
                this.report(node, "INCOMPATIBLE_OPERANDS", `Operandos incompatibles para ${node.operator}`);
            }
            return NativeTypes.Boolean;
        }

        if (node.operator === "+") {
            if (IsNamedType(left, "String") && IsNamedType(right, "String")) {
                return NativeTypes.String;
            }
            if (IsNamedType(left, "Number") && IsNamedType(right, "Number")) {
                return NativeTypes.Number;
            }
            this.report(node, "INCOMPATIBLE_OPERANDS", "El operador + requiere dos String o dos Number");
            return UnknownType;
        }

        if (["-", "*", "/", "%"].includes(node.operator)) {
            this.requireNumber(left, node.left, node.operator);
            this.requireNumber(right, node.right, node.operator);
            return NativeTypes.Number;
        }

        return UnknownType;
    }

    inferLogicalExpression(node) {
        const left = this.inferExpression(node.left);
        const right = this.inferExpression(node.right);
        this.requireBoolean(left, node.left, node.operator);
        this.requireBoolean(right, node.right, node.operator);
        return NativeTypes.Boolean;
    }

    inferUnaryExpression(node) {
        const argument = this.inferExpression(node.argument);
        if (node.operator === "!") {
            this.requireBoolean(argument, node.argument, node.operator);
            return NativeTypes.Boolean;
        }

        this.requireNumber(argument, node.argument, node.operator);
        return NativeTypes.Number;
    }

    inferAssignmentExpression(node) {
        const leftType = this.validateAssignmentTarget(node.left);
        const rightType = this.inferExpression(node.right);

        if (node.operator === "=") {
            if (!IsAssignable(rightType, leftType)) {
                this.report(
                    node,
                    "INCOMPATIBLE_ASSIGNMENT",
                    `No se puede asignar ${this.typeName(rightType)} a ${this.typeName(leftType)}`,
                );
            }
            return leftType;
        }

        if (node.operator === "+=") {
            if (
                !(IsNamedType(leftType, "String") && IsNamedType(rightType, "String"))
                && !(IsNamedType(leftType, "Number") && IsNamedType(rightType, "Number"))
            ) {
                this.report(node, "INCOMPATIBLE_ASSIGNMENT", "+= requiere valores del mismo tipo String o Number");
            }
            return leftType;
        }

        this.requireNumber(leftType, node.left, node.operator);
        this.requireNumber(rightType, node.right, node.operator);
        return NativeTypes.Number;
    }

    inferUpdateExpression(node) {
        const argument = this.validateAssignmentTarget(node.argument);
        this.requireNumber(argument, node.argument, node.operator);
        return NativeTypes.Number;
    }

    validateAssignmentTarget(node) {
        if (node.type === Ast.NodeType.IDENTIFIER) {
            const resolved = this.currentScope.find(node.name);
            if (!resolved) {
                this.report(node, "UNDEFINED_IDENTIFIER", `El identificador ${node.name} no está declarado`);
                return UnknownType;
            }
            if (!resolved.binding.mutable) {
                this.report(node, "CONST_REASSIGNMENT", `No se puede reasignar la constante ${node.name}`);
            }
            return resolved.type;
        }

        if (node.type === Ast.NodeType.MEMBER_EXPRESSION) {
            const objectType = this.inferExpression(node.object);
            const propertyType = this.inferMemberExpressionFromKnownObject(node, objectType);
            const propertyName = this.getStaticPropertyName(node);
            const property = propertyName === null ? null : objectType.properties?.[propertyName];

            if (objectType.readOnly || property?.readOnly) {
                this.report(node, "READ_ONLY_VALUE", "No se puede modificar un valor nativo de solo lectura");
            }
            return propertyType;
        }

        this.report(node, "INVALID_ASSIGNMENT_TARGET", "El destino de la asignación no es modificable");
        this.inferExpression(node);
        return UnknownType;
    }

    inferMemberExpressionFromKnownObject(node, objectType) {
        if (objectType.kind === TypeKind.ARRAY) {
            this.inferExpression(node.property);
            return objectType.elementType;
        }

        if (objectType.kind !== TypeKind.OBJECT) {
            this.report(node.object, "INVALID_MEMBER_ACCESS", "El valor no expone propiedades");
            return UnknownType;
        }

        const propertyName = this.getStaticPropertyName(node);
        if (propertyName === null) {
            this.inferExpression(node.property);
            return UnknownType;
        }

        const property = objectType.properties[propertyName];
        if (!property) {
            this.report(node.property, "UNKNOWN_PROPERTY", `La propiedad ${propertyName} no existe`);
            return UnknownType;
        }
        return property.type;
    }

    validateValueAgainstType(node, actualType, expectedType, label) {
        if (
            expectedType.kind === TypeKind.OBJECT
            && actualType.kind === TypeKind.OBJECT
            && actualType.name === "ObjectLiteral"
        ) {
            if (expectedType.readOnly) {
                this.report(
                    node,
                    "CONTROLLED_TYPE_REQUIRED",
                    `${label} requiere un valor ${expectedType.name} obtenido mediante una función nativa`,
                );
                return;
            }
            this.validateObjectAgainstContract(node, actualType, expectedType, label);
            return;
        }

        if (!IsAssignable(actualType, expectedType)) {
            this.report(
                node,
                "INCOMPATIBLE_ARGUMENT",
                `${label} requiere ${FormatType(expectedType)} y recibió ${this.typeName(actualType)}`,
            );
        }
    }

    validateObjectAgainstContract(node, actualType, expectedType, label) {
        for (const propertyName of Object.keys(actualType.properties)) {
            if (!Object.prototype.hasOwnProperty.call(expectedType.properties, propertyName)) {
                this.report(node, "UNKNOWN_CONFIG_PROPERTY", `${label} no admite la propiedad ${propertyName}`);
            }
        }

        for (const [propertyName, contract] of Object.entries(expectedType.properties)) {
            const actual = actualType.properties[propertyName];
            if (!actual) {
                if (contract.required) {
                    this.report(node, "MISSING_CONFIG_PROPERTY", `${label} requiere la propiedad ${propertyName}`);
                }
                continue;
            }

            this.validateValueAgainstType(actual.node, actual.type, contract.type, `${label}.${propertyName}`);
            this.validateLiteralConstraints(actual.node, contract, `${label}.${propertyName}`);
        }

        if (
            expectedType.requiresAny
            && !expectedType.requiresAny.some((property) => actualType.properties[property])
        ) {
            this.report(
                node,
                "EMPTY_EMBED",
                `${label} requiere al menos un atributo propio del embed`,
            );
        }

        if (expectedType.name === "SendEmbedConfig" || expectedType.name === "ReplyEmbedConfig") {
            const total = ["title", "description"]
                .map((property) => actualType.properties[property]?.node)
                .filter((value) => value?.type === Ast.NodeType.STRING_LITERAL)
                .reduce((sum, value) => sum + value.value.length, 0)
                + this.nestedLiteralLength(actualType, "author", "name")
                + this.nestedLiteralLength(actualType, "footer", "text");

            if (total > 6000) {
                this.report(node, "EMBED_TOO_LONG", "El contenido total del embed supera 6000 caracteres");
            }
        }
    }

    validateLiteralConstraints(node, contract, label) {
        if (node.type !== Ast.NodeType.STRING_LITERAL) {
            return;
        }

        if (contract.minLength !== undefined && node.value.length < contract.minLength) {
            this.report(node, "STRING_TOO_SHORT", `${label} es demasiado corto`);
        }

        if (contract.maxLength !== undefined && node.value.length > contract.maxLength) {
            this.report(node, "STRING_TOO_LONG", `${label} supera ${contract.maxLength} caracteres`);
        }

        if (contract.format === "snowflake" && !/^\d{17,20}$/.test(node.value)) {
            this.report(node, "INVALID_SNOWFLAKE", `${label} no contiene un identificador de Discord válido`);
        }

        if (contract.format === "hex-color" && !/^#[0-9A-Fa-f]{6}$/.test(node.value)) {
            this.report(node, "INVALID_COLOR", `${label} debe utilizar el formato #RRGGBB`);
        }

        if (contract.format === "http-url") {
            try {
                const parsed = new URL(node.value);
                if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
            } catch {
                this.report(node, "INVALID_URL", `${label} debe ser una URL HTTP o HTTPS válida`);
            }
        }
    }

    nestedLiteralLength(objectType, propertyName, nestedName) {
        const nested = objectType.properties[propertyName]?.type;
        const node = nested?.properties?.[nestedName]?.node;
        return node?.type === Ast.NodeType.STRING_LITERAL ? node.value.length : 0;
    }

    getNullNarrowing(node) {
        if (
            node.type !== Ast.NodeType.BINARY_EXPRESSION
            || (node.operator !== "===" && node.operator !== "!==")
        ) {
            return null;
        }

        const identifier = node.left.type === Ast.NodeType.IDENTIFIER
            && node.right.type === Ast.NodeType.NULL_LITERAL
            ? node.left
            : node.right.type === Ast.NodeType.IDENTIFIER
                && node.left.type === Ast.NodeType.NULL_LITERAL
                ? node.right
                : null;

        if (!identifier) return null;
        const resolved = this.currentScope.find(identifier.name);
        if (!resolved || !IsNullable(resolved.type)) return null;

        return {
            name: identifier.name,
            nonNullType: WithoutNull(resolved.type),
            nonNullWhenTrue: node.operator === "!==",
        };
    }

    getStaticPropertyName(node) {
        if (!node.computed && node.property.type === Ast.NodeType.IDENTIFIER) {
            return node.property.name;
        }

        if (node.computed && node.property.type === Ast.NodeType.STRING_LITERAL) {
            return node.property.value;
        }

        return null;
    }

    areComparable(left, right) {
        return (
            IsNamedType(left, "Number") && IsNamedType(right, "Number")
        ) || (
            IsNamedType(left, "String") && IsNamedType(right, "String")
        ) || IsUnknown(left) || IsUnknown(right);
    }

    requireNumber(type, node, operator) {
        if (!IsUnknown(type) && !IsNamedType(type, "Number")) {
            this.report(node, "NUMBER_REQUIRED", `${operator} requiere un Number`);
        }
    }

    requireBoolean(type, node, operator) {
        if (!IsUnknown(type) && !IsNamedType(type, "Boolean")) {
            this.report(node, "BOOLEAN_REQUIRED", `${operator} requiere un Boolean`);
        }
    }

    typeName(type) {
        return type?.name ?? "Unknown";
    }

    withScope(callback, narrowings = new Map()) {
        const previous = this.currentScope;
        const scope = new Scope(previous, narrowings);
        this.currentScope = scope;
        this.scopes.push(scope);
        callback();
        this.currentScope = previous;
    }

    report(node, code, message) {
        this.diagnostics.push(
            CreateDiagnostic("semantic", code, message, node.loc.start, node.loc.end),
        );
    }
}

const Validate = (ast, nativeRegistry) => {
    if (!ast || ast.type !== Ast.NodeType.PROGRAM) {
        const origin = { line: 1, column: 0, offset: 0 };
        return {
            ok: false,
            value: { ast, analysis: null },
            diagnostics: [
                CreateDiagnostic(
                    "semantic",
                    "INVALID_AST",
                    "El validador requiere un Program",
                    origin,
                    origin,
                ),
            ],
        };
    }

    return new SemanticValidator(ast, nativeRegistry).validate();
};

module.exports = {
    UnknownType,
    SemanticValidator,
    Validate,
};
