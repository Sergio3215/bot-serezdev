const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CompileCustomCommand,
    Execute,
    Native,
    NativeImplementations,
} = require("../commands/custom/language/index.js");

const Compile = (code) => CompileCustomCommand({
    id: "conversion-command",
    serverId: "server-id",
    command: "!convert",
    triggerType: "exact",
    allowedRoleIds: [],
    code,
});

const ExecuteSource = async (code, runtimeContext = {}) => {
    const compilation = Compile(code);
    assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics));
    return Execute(compilation.value.compiledCommand.program.instructions, runtimeContext);
};

test("string convierte únicamente strings, números finitos y booleanos", () => {
    assert.equal(NativeImplementations.string("abc"), "abc");
    assert.equal(NativeImplementations.string(""), "");
    assert.equal(NativeImplementations.string(10), "10");
    assert.equal(NativeImplementations.string(-10), "-10");
    assert.equal(NativeImplementations.string(10.5), "10.5");
    assert.equal(NativeImplementations.string(-10.5), "-10.5");
    assert.equal(NativeImplementations.string(true), "true");
    assert.equal(NativeImplementations.string(false), "false");

    for (const invalid of [null, undefined, [], {}, Number.NaN, Infinity, -Infinity]) {
        assert.throws(() => NativeImplementations.string(invalid), /string requiere/);
    }
});

test("int conserva integers, trunca hacia cero y parsea strings completos", () => {
    assert.equal(NativeImplementations.int(10), 10);
    assert.equal(NativeImplementations.int(10.0), 10);
    assert.equal(NativeImplementations.int(10.9), 10);
    assert.equal(NativeImplementations.int(-10.9), -10);
    assert.equal(NativeImplementations.int("10"), 10);
    assert.equal(NativeImplementations.int("-10"), -10);
    assert.equal(NativeImplementations.int("+10"), 10);
    assert.equal(NativeImplementations.int("0"), 0);
    assert.equal(NativeImplementations.int(-0.9), 0);

    for (const invalid of [
        "",
        " ",
        "10.5",
        "1e3",
        "10abc",
        "abc10",
        "NaN",
        "Infinity",
        true,
        false,
        Number.NaN,
        Infinity,
        -Infinity,
    ]) {
        assert.throws(() => NativeImplementations.int(invalid), /int/);
    }
});

test("decimal acepta números finitos y una gramática decimal estricta", () => {
    assert.equal(NativeImplementations.decimal(10), 10);
    assert.equal(NativeImplementations.decimal(10.5), 10.5);
    assert.equal(NativeImplementations.decimal("10"), 10);
    assert.equal(NativeImplementations.decimal("-10"), -10);
    assert.equal(NativeImplementations.decimal("+10.5"), 10.5);
    assert.equal(NativeImplementations.decimal("10.5"), 10.5);
    assert.equal(NativeImplementations.decimal("-10.5"), -10.5);
    assert.equal(NativeImplementations.decimal("0.25"), 0.25);

    for (const invalid of [
        "",
        " ",
        ".5",
        "5.",
        "1e3",
        "10abc",
        "abc10",
        "NaN",
        "Infinity",
        true,
        false,
        Number.NaN,
        Infinity,
        -Infinity,
    ]) {
        assert.throws(() => NativeImplementations.decimal(invalid), /decimal/);
    }
});

test("bool acepta solo booleanos y strings exactos true/false", () => {
    assert.equal(NativeImplementations.bool(true), true);
    assert.equal(NativeImplementations.bool(false), false);
    assert.equal(NativeImplementations.bool("true"), true);
    assert.equal(NativeImplementations.bool("false"), false);

    for (const invalid of [
        "TRUE",
        "False",
        "yes",
        "no",
        "1",
        "0",
        "",
        " ",
        1,
        0,
        [],
        {},
        null,
        undefined,
    ]) {
        assert.throws(() => NativeImplementations.bool(invalid), /bool requiere/);
    }
});

test("NativeRegistry declara aridad y tipos exactos para las conversiones", () => {
    const expected = {
        string: "String",
        int: "Number",
        decimal: "Number",
        bool: "Boolean",
    };

    for (const [name, returnType] of Object.entries(expected)) {
        const entry = Native.nativeRegistry.get(name);
        assert.ok(entry, name);
        assert.equal(entry.metadata.parameters.length, 1);
        assert.equal(entry.metadata.parameters[0].required, true);
        assert.equal(entry.metadata.returns.type.name, returnType);
    }

    for (const source of [
        "string()",
        "string(1, 2)",
        "int()",
        "int(1, 2)",
        "decimal()",
        "decimal(1, 2)",
        "bool()",
        "bool(true, false)",
    ]) {
        const compilation = Compile(`const value = ${source}`);
        assert.equal(compilation.ok, false, source);
        assert.ok(compilation.diagnostics.some(
            (diagnostic) => diagnostic.code === "INVALID_ARGUMENT_COUNT",
        ));
    }
});

test("el validador rechaza tipos fuera de la matriz de conversión", () => {
    for (const source of [
        "string([])",
        "string({ value: 1 })",
        "string(null)",
        "int(true)",
        "int([])",
        "decimal(false)",
        "decimal({ value: 1 })",
        "bool(1)",
        "bool([])",
        "bool({ value: 1 })",
    ]) {
        const compilation = Compile(`const value = ${source}`);
        assert.equal(compilation.ok, false, source);
        assert.ok(compilation.diagnostics.some(
            (diagnostic) => diagnostic.code === "INCOMPATIBLE_ARGUMENT",
        ));
    }
});

test("errores de contenido y valores no finitos generan diagnósticos nativos", async () => {
    for (const source of [
        'const value = int("10.5")',
        'const value = int("abc")',
        'const value = decimal("abc")',
        'const value = bool("TRUE")',
        "const value = int(1 / 0)",
        "const value = decimal(0 / 0)",
        "const value = string(1 / 0)",
    ]) {
        const result = await ExecuteSource(source);
        assert.equal(result.ok, false, source);
        assert.equal(result.diagnostics[0].phase, "native");
        assert.equal(result.diagnostics[0].code, "NATIVE_EXECUTION_ERROR");
    }
});

test("un Custom Command real combina conversiones con natives del Sprint 2", async () => {
    const replies = [];
    const result = await ExecuteSource(`
        const count = int("42")
        const truncated = int(-10.9)
        const amount = decimal("10.5")
        const active = bool(5 > 3)
        const members = string(memberCount())
        const roll = string(randomRange(1, 1))
        if (active && amount === 10.5) {
            ReplyMessage({ message: string(count) + ":" + string(truncated) + ":" + string(amount) + ":" + string(active) + ":" + members + ":" + roll })
        }
    `, {
        guild: { memberCount: 7 },
        sourceMessage: {
            async reply(payload) {
                replies.push(payload);
            },
        },
    });

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(replies, [{ content: "42:-10:10.5:true:7:1" }]);
});

test("built-ins de conversión JavaScript permanecen fuera del lenguaje", () => {
    for (const source of [
        'String("x")',
        'Number("1")',
        'Boolean("true")',
        'parseInt("1")',
        'parseFloat("1.5")',
        'eval("1")',
        'Function("return 1")',
        "global",
        "globalThis",
    ]) {
        const compilation = Compile(`const value = ${source}`);
        assert.equal(compilation.ok, false, source);
    }
});
