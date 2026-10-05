const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CompileCustomCommand,
    Execute,
    Native,
    NativeImplementations,
} = require("../commands/custom/language/index.js");
const {
    ExecuteCompiledCustomCommand,
} = require("../commands/custom/runner.js");

const IDS = Object.freeze({
    user: "111111111111111111",
    channel: "222222222222222222",
    server: "333333333333333333",
});
const FIXED_TIMESTAMP = Date.UTC(2026, 9, 5, 14, 3, 9);

const Compile = (code) => CompileCustomCommand({
    id: "native-command",
    serverId: IDS.server,
    command: "!native",
    triggerType: "exact",
    allowedRoleIds: [],
    code,
});

const RuntimeContext = (overrides = {}) => {
    const replies = [];
    const sourceMessage = {
        content: "!native",
        author: {
            id: IDS.user,
            username: "serez-user",
            bot: false,
        },
        channel: { id: IDS.channel },
        async reply(payload) {
            replies.push(payload);
        },
    };

    return {
        replies,
        context: {
            sourceMessage,
            channel: sourceMessage.channel,
            authorMember: {
                id: IDS.user,
                displayName: "Serez Display",
                user: sourceMessage.author,
                roles: { cache: new Map() },
            },
            guild: {
                id: IDS.server,
                memberCount: 42,
            },
            nativeServices: {
                random: () => 0.5,
                now: () => FIXED_TIMESTAMP,
            },
            ...overrides,
        },
    };
};

const ExecuteSource = async (code, runtimeContext) => {
    const compilation = Compile(code);
    assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics));
    return Execute(compilation.value.compiledCommand.program.instructions, runtimeContext);
};

test("el registro expone todas las nuevas nativas y ninguna API insegura", () => {
    const expected = [
        "random",
        "randomRange",
        "choose",
        "now",
        "date",
        "time",
        "username",
        "displayName",
        "userId",
        "channelId",
        "serverId",
        "memberCount",
        "upper",
        "lower",
        "length",
    ];
    const forbidden = [
        "Math",
        "Date",
        "process",
        "require",
        "eval",
        "Function",
        "global",
        "globalThis",
        "module",
        "exports",
    ];

    for (const name of expected) assert.equal(Native.nativeRegistry.has(name), true, name);
    for (const name of forbidden) assert.equal(Native.nativeRegistry.has(name), false, name);
});

test("upper, lower y length operan solo sobre tipos permitidos", () => {
    assert.equal(NativeImplementations.upper("hola"), "HOLA");
    assert.equal(NativeImplementations.upper(""), "");
    assert.equal(NativeImplementations.lower("HOLA"), "hola");
    assert.equal(NativeImplementations.lower(""), "");
    assert.equal(NativeImplementations.length("Hola"), 4);
    assert.equal(NativeImplementations.length([1, 2, 3]), 3);

    assert.throws(() => NativeImplementations.upper(1), /String/);
    assert.throws(() => NativeImplementations.lower(null), /String/);
    assert.throws(() => NativeImplementations.length({ length: 5 }), /String o un Array/);
});

test("random devuelve números dentro de 0 inclusivo y 1 exclusivo", () => {
    for (let index = 0; index < 200; index += 1) {
        const value = NativeImplementations.random({});
        assert.equal(typeof value, "number");
        assert.equal(Number.isNaN(value), false);
        assert.ok(value >= 0 && value < 1);
    }

    assert.equal(
        NativeImplementations.random({ nativeServices: { random: () => 0 } }),
        0,
    );
    assert.throws(
        () => NativeImplementations.random({ nativeServices: { random: () => 1 } }),
        /entre 0 inclusive y 1 exclusivo/,
    );
});

test("randomRange es entero, inclusivo y valida límites y tipos", () => {
    assert.equal(
        NativeImplementations.randomRange({ nativeServices: { random: () => 0 } }, 1, 10),
        1,
    );
    assert.equal(
        NativeImplementations.randomRange({ nativeServices: { random: () => 0.999999 } }, 1, 10),
        10,
    );
    assert.equal(
        NativeImplementations.randomRange({ nativeServices: { random: () => 0 } }, -10, -2),
        -10,
    );
    assert.equal(NativeImplementations.randomRange({}, 7, 7), 7);

    assert.throws(() => NativeImplementations.randomRange({}, 2, 1), /min/);
    assert.throws(() => NativeImplementations.randomRange({}, 1.5, 2), /enteros/);
    assert.throws(() => NativeImplementations.randomRange({}, "1", 2), /enteros/);
});

test("choose selecciona desde un array no vacío sin mutarlo", () => {
    const values = Object.freeze(["rojo", "verde", "azul"]);
    assert.equal(
        NativeImplementations.choose({ nativeServices: { random: () => 0 } }, values),
        "rojo",
    );
    assert.equal(
        NativeImplementations.choose({ nativeServices: { random: () => 0.999999 } }, values),
        "azul",
    );
    assert.deepEqual(values, ["rojo", "verde", "azul"]);
    assert.throws(() => NativeImplementations.choose({}, []), /no vacío/);
    assert.throws(() => NativeImplementations.choose({}, "rojo"), /array/);
});

test("now, date y time usan un reloj inyectable y UTC estable", () => {
    const context = { nativeServices: { now: () => FIXED_TIMESTAMP } };
    assert.equal(NativeImplementations.now(context), FIXED_TIMESTAMP);
    assert.equal(NativeImplementations.date(context), "2026-10-05");
    assert.equal(NativeImplementations.time(context), "14:03:09");
    assert.equal(typeof NativeImplementations.now({}), "number");
    assert.throws(
        () => NativeImplementations.now({ nativeServices: { now: () => Number.NaN } }),
        /timestamp entero/,
    );
});

test("las nativas de Discord leen únicamente el contexto disponible", () => {
    const { context } = RuntimeContext();
    assert.equal(NativeImplementations.username(context), "serez-user");
    assert.equal(NativeImplementations.displayName(context), "Serez Display");
    assert.equal(NativeImplementations.userId(context), IDS.user);
    assert.equal(NativeImplementations.channelId(context), IDS.channel);
    assert.equal(NativeImplementations.serverId(context), IDS.server);
    assert.equal(NativeImplementations.memberCount(context), 42);

    assert.equal(
        NativeImplementations.displayName({
            sourceMessage: context.sourceMessage,
            authorMember: { displayName: "" },
        }),
        "serez-user",
    );
    assert.throws(() => NativeImplementations.username({}), /username/);
    assert.throws(() => NativeImplementations.displayName({}), /username/);
    assert.throws(() => NativeImplementations.userId({}), /autor/);
    assert.throws(() => NativeImplementations.channelId({}), /canal/);
    assert.throws(() => NativeImplementations.serverId({}), /servidor/);
    assert.throws(() => NativeImplementations.memberCount({}), /miembros/);
});

test("el validador aplica aridad exacta y tipos a las nuevas nativas", () => {
    const invalidCalls = [
        "random(1)",
        "randomRange(1)",
        "randomRange(1, 2, 3)",
        "choose()",
        "choose(\"uno\")",
        "now(1)",
        "date(1)",
        "time(1)",
        "username(1)",
        "displayName(1)",
        "userId(1)",
        "channelId(1)",
        "serverId(1)",
        "memberCount(1)",
        "upper()",
        "upper(1)",
        "lower()",
        "lower(false)",
        "length()",
        "length({ value: 1 })",
    ];

    for (const call of invalidCalls) {
        const compilation = Compile(`const value = ${call}`);
        assert.equal(compilation.ok, false, call);
        assert.ok(
            compilation.diagnostics.some((diagnostic) => (
                diagnostic.code === "INVALID_ARGUMENT_COUNT"
                || diagnostic.code === "INCOMPATIBLE_ARGUMENT"
            )),
            `${call}: ${JSON.stringify(compilation.diagnostics)}`,
        );
    }
});

test("choose conserva el tipo del elemento durante validación semántica", () => {
    const strings = Compile(`ReplyMessage({ message: choose(["uno", "dos"]) })`);
    const numbers = Compile(`
        const value = choose([1, 2, 3])
        if (value > 0) {
            ReplyMessage({ message: "ok" })
        }
    `);

    assert.equal(strings.ok, true, JSON.stringify(strings.diagnostics));
    assert.equal(numbers.ok, true, JSON.stringify(numbers.diagnostics));
});

test("un Custom Command compilado ejecuta las nuevas nativas juntas", async () => {
    const { context, replies } = RuntimeContext();
    const result = await ExecuteSource(`
        const selected = choose(["uno", "dos"])
        const current = now()
        if (random() >= 0 && randomRange(1, 1) === 1 && current === ${FIXED_TIMESTAMP} && date() === "2026-10-05" && time() === "14:03:09" && length(selected) > 0 && username() === "serez-user" && userId() === "${IDS.user}" && channelId() === "${IDS.channel}" && serverId() === "${IDS.server}" && memberCount() === 42) {
            ReplyMessage({ message: upper(lower(displayName())) })
        }
    `, context);

    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(replies, [{ content: "SEREZ DISPLAY" }]);
});

test("los errores de implementación se convierten en diagnósticos nativos controlados", async () => {
    const { context } = RuntimeContext();
    const result = await ExecuteSource("const value = choose([])", context);

    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].phase, "native");
    assert.equal(result.diagnostics[0].code, "NATIVE_EXECUTION_ERROR");
    assert.match(result.diagnostics[0].message, /choose/);
});

test("el runner real entrega contexto Discord a las nuevas nativas", async () => {
    const compilation = Compile(`ReplyMessage({ message: username() })`);
    assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics));

    const replies = [];
    const author = { id: IDS.user, username: "runner-user", bot: false };
    const member = {
        id: IDS.user,
        displayName: "Runner Display",
        user: author,
        roles: { cache: new Map() },
    };
    const msg = {
        content: "!native",
        author,
        member,
        channel: { id: IDS.channel },
        guild: {
            id: IDS.server,
            memberCount: 7,
            members: { cache: new Map([[IDS.user, member]]) },
        },
        async reply(payload) {
            replies.push(payload);
        },
    };

    const handled = await ExecuteCompiledCustomCommand(
        { user: { id: "999999999999999999" } },
        msg,
        compilation.value.compiledCommand,
    );

    assert.equal(handled, true);
    assert.deepEqual(replies, [{ content: "runner-user" }]);
});

test("el compilador rechaza accesos a globals y APIs JavaScript inseguras", () => {
    const unsafeSources = [
        "const value = Math.random()",
        "const value = Date()",
        "const value = process",
        "const value = require(\"node:fs\")",
        "const value = eval(\"1 + 1\")",
        "const value = Function(\"return 1\")",
        "const value = global",
        "const value = globalThis",
        "const value = module",
        "const value = exports",
    ];

    for (const source of unsafeSources) {
        const compilation = Compile(source);
        assert.equal(compilation.ok, false, source);
    }
});
