const NodeType = Object.freeze({
    PROGRAM: "Program",
    BLOCK_STATEMENT: "BlockStatement",
    EXPRESSION_STATEMENT: "ExpressionStatement",
    VARIABLE_DECLARATION: "VariableDeclaration",
    VARIABLE_DECLARATOR: "VariableDeclarator",
    IF_STATEMENT: "IfStatement",
    FOR_OF_STATEMENT: "ForOfStatement",
    BREAK_STATEMENT: "BreakStatement",
    CONTINUE_STATEMENT: "ContinueStatement",
    IDENTIFIER: "Identifier",
    STRING_LITERAL: "StringLiteral",
    NUMBER_LITERAL: "NumberLiteral",
    BOOLEAN_LITERAL: "BooleanLiteral",
    NULL_LITERAL: "NullLiteral",
    CALL_EXPRESSION: "CallExpression",
    OBJECT_EXPRESSION: "ObjectExpression",
    PROPERTY: "Property",
    ARRAY_EXPRESSION: "ArrayExpression",
    MEMBER_EXPRESSION: "MemberExpression",
    BINARY_EXPRESSION: "BinaryExpression",
    LOGICAL_EXPRESSION: "LogicalExpression",
    UNARY_EXPRESSION: "UnaryExpression",
    ASSIGNMENT_EXPRESSION: "AssignmentExpression",
    UPDATE_EXPRESSION: "UpdateExpression",
});

const NODE_TYPES = new Set(Object.values(NodeType));

const StatementNodeTypes = Object.freeze([
    NodeType.BLOCK_STATEMENT,
    NodeType.EXPRESSION_STATEMENT,
    NodeType.VARIABLE_DECLARATION,
    NodeType.IF_STATEMENT,
    NodeType.FOR_OF_STATEMENT,
    NodeType.BREAK_STATEMENT,
    NodeType.CONTINUE_STATEMENT,
]);

const ExpressionNodeTypes = Object.freeze([
    NodeType.IDENTIFIER,
    NodeType.STRING_LITERAL,
    NodeType.NUMBER_LITERAL,
    NodeType.BOOLEAN_LITERAL,
    NodeType.NULL_LITERAL,
    NodeType.CALL_EXPRESSION,
    NodeType.OBJECT_EXPRESSION,
    NodeType.ARRAY_EXPRESSION,
    NodeType.MEMBER_EXPRESSION,
    NodeType.BINARY_EXPRESSION,
    NodeType.LOGICAL_EXPRESSION,
    NodeType.UNARY_EXPRESSION,
    NodeType.ASSIGNMENT_EXPRESSION,
    NodeType.UPDATE_EXPRESSION,
]);

const STATEMENT_NODE_TYPES = new Set(StatementNodeTypes);
const EXPRESSION_NODE_TYPES = new Set(ExpressionNodeTypes);

const ClonePosition = (position) => {
    if (
        position === null
        || typeof position !== "object"
        || !Number.isInteger(position.line)
        || !Number.isInteger(position.column)
        || !Number.isInteger(position.offset)
    ) {
        throw new TypeError("La posición de un nodo AST es inválida");
    }

    return {
        line: position.line,
        column: position.column,
        offset: position.offset,
    };
};

const CloneLocation = (loc) => {
    if (loc === null || typeof loc !== "object") {
        throw new TypeError("Todo nodo AST requiere una ubicación");
    }

    return {
        start: ClonePosition(loc.start),
        end: ClonePosition(loc.end),
    };
};

const CreateNode = (type, properties, loc) => {
    if (!NODE_TYPES.has(type)) {
        throw new TypeError(`Tipo de nodo AST desconocido: ${type}`);
    }

    return {
        type,
        ...properties,
        loc: CloneLocation(loc),
    };
};

const CreateProgram = (body, loc) =>
    CreateNode(NodeType.PROGRAM, { body }, loc);

const CreateBlockStatement = (body, loc) =>
    CreateNode(NodeType.BLOCK_STATEMENT, { body }, loc);

const CreateExpressionStatement = (expression, loc) =>
    CreateNode(NodeType.EXPRESSION_STATEMENT, { expression }, loc);

const CreateVariableDeclaration = (kind, declarations, loc) =>
    CreateNode(NodeType.VARIABLE_DECLARATION, { kind, declarations }, loc);

const CreateVariableDeclarator = (id, init, loc) =>
    CreateNode(NodeType.VARIABLE_DECLARATOR, { id, init }, loc);

const CreateIfStatement = (test, consequent, alternate, loc) =>
    CreateNode(NodeType.IF_STATEMENT, { test, consequent, alternate }, loc);

const CreateForOfStatement = (left, right, body, loc) =>
    CreateNode(NodeType.FOR_OF_STATEMENT, { left, right, body }, loc);

const CreateBreakStatement = (loc) =>
    CreateNode(NodeType.BREAK_STATEMENT, {}, loc);

const CreateContinueStatement = (loc) =>
    CreateNode(NodeType.CONTINUE_STATEMENT, {}, loc);

const CreateIdentifier = (name, loc) =>
    CreateNode(NodeType.IDENTIFIER, { name }, loc);

const CreateStringLiteral = (value, loc) =>
    CreateNode(NodeType.STRING_LITERAL, { value }, loc);

const CreateNumberLiteral = (value, loc) =>
    CreateNode(NodeType.NUMBER_LITERAL, { value }, loc);

const CreateBooleanLiteral = (value, loc) =>
    CreateNode(NodeType.BOOLEAN_LITERAL, { value }, loc);

const CreateNullLiteral = (loc) =>
    CreateNode(NodeType.NULL_LITERAL, { value: null }, loc);

const CreateCallExpression = (callee, args, loc) =>
    CreateNode(NodeType.CALL_EXPRESSION, { callee, arguments: args }, loc);

const CreateObjectExpression = (properties, loc) =>
    CreateNode(NodeType.OBJECT_EXPRESSION, { properties }, loc);

const CreateProperty = (key, value, loc) =>
    CreateNode(NodeType.PROPERTY, { key, value }, loc);

const CreateArrayExpression = (elements, loc) =>
    CreateNode(NodeType.ARRAY_EXPRESSION, { elements }, loc);

const CreateMemberExpression = (object, property, computed, loc) =>
    CreateNode(NodeType.MEMBER_EXPRESSION, { object, property, computed }, loc);

const CreateBinaryExpression = (operator, left, right, loc) =>
    CreateNode(NodeType.BINARY_EXPRESSION, { operator, left, right }, loc);

const CreateLogicalExpression = (operator, left, right, loc) =>
    CreateNode(NodeType.LOGICAL_EXPRESSION, { operator, left, right }, loc);

const CreateUnaryExpression = (operator, argument, prefix, loc) =>
    CreateNode(NodeType.UNARY_EXPRESSION, { operator, argument, prefix }, loc);

const CreateAssignmentExpression = (operator, left, right, loc) =>
    CreateNode(NodeType.ASSIGNMENT_EXPRESSION, { operator, left, right }, loc);

const CreateUpdateExpression = (operator, argument, prefix, loc) =>
    CreateNode(NodeType.UPDATE_EXPRESSION, { operator, argument, prefix }, loc);

const IsNode = (value) =>
    value !== null && typeof value === "object" && NODE_TYPES.has(value.type);

const IsStatement = (value) =>
    IsNode(value) && STATEMENT_NODE_TYPES.has(value.type);

const IsExpression = (value) =>
    IsNode(value) && EXPRESSION_NODE_TYPES.has(value.type);

module.exports = {
    NodeType,
    StatementNodeTypes,
    ExpressionNodeTypes,
    CloneLocation,
    CreateNode,
    CreateProgram,
    CreateBlockStatement,
    CreateExpressionStatement,
    CreateVariableDeclaration,
    CreateVariableDeclarator,
    CreateIfStatement,
    CreateForOfStatement,
    CreateBreakStatement,
    CreateContinueStatement,
    CreateIdentifier,
    CreateStringLiteral,
    CreateNumberLiteral,
    CreateBooleanLiteral,
    CreateNullLiteral,
    CreateCallExpression,
    CreateObjectExpression,
    CreateProperty,
    CreateArrayExpression,
    CreateMemberExpression,
    CreateBinaryExpression,
    CreateLogicalExpression,
    CreateUnaryExpression,
    CreateAssignmentExpression,
    CreateUpdateExpression,
    IsNode,
    IsStatement,
    IsExpression,
};
