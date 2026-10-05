const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, CustomCommand } = require("../db/index.js");
const {
    createCustomCommandController,
    validateAllowedRoleIds,
    validateTriggerType,
} = require("../server/routes/customCommand/customCommand.controller.js");
const { CompileCustomCommand } = require("../commands/custom/language/index.js");
const {
    FindCustomCommandInServerMap,
    GetCustomCommandFromMap,
    LoadCustomCommandMap,
} = require("../commands/custom/index.js");
const {
    HasCustomCommandPermission,
    RunCustomCommandInternal,
} = require("../commands/custom/runner.js");

const ROLE_A = "111111111111111111";
const ROLE_B = "222222222222222222";
const ROLE_ORPHAN = "333333333333333333";
const AUTHOR_ID = "444444444444444444";

const response = () => ({
    statusCode: 200,
    body: undefined,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
});

const validCommandBody = {
    serverId: "server-1",
    command: "!hola",
    code: "SendMessage({ message: \"Hola\" })",
    enabled: true,
};

const compiled = (id, command, triggerType, allowedRoleIds = []) => ({
    id,
    serverId: "server-1",
    command,
    triggerType,
    allowedRoleIds,
});

const createPermissionContext = ({
    guildRoles = [ROLE_A, ROLE_B],
    memberRoles = [],
    administrator = false,
} = {}) => {
    const member = {
        id: AUTHOR_ID,
        roles: {
            cache: new Map(memberRoles.map((id) => [id, { id }])),
        },
        permissions: {
            has() {
                return administrator;
            },
        },
    };

    return {
        member,
        msg: {
            guild: {
                roles: {
                    cache: new Map(guildRoles.map((id) => [id, { id }])),
                },
            },
        },
    };
};

test("valida trigger types y normaliza roles duplicados", () => {
    for (const triggerType of ["exact", "startsWith", "endsWith", "include"]) {
        assert.deepEqual(validateTriggerType(triggerType), { value: triggerType });
    }
    assert.deepEqual(validateTriggerType(undefined), { value: "include" });
    assert.match(validateTriggerType("legacy").error, /inválido/);

    assert.deepEqual(validateAllowedRoleIds(undefined), { value: [] });
    assert.deepEqual(
        validateAllowedRoleIds([ROLE_A, ROLE_A, ROLE_B]),
        { value: [ROLE_A, ROLE_B] },
    );
    assert.match(validateAllowedRoleIds("not-an-array").error, /array/);
    assert.match(validateAllowedRoleIds([""]).error, /snowflake/);
    assert.match(validateAllowedRoleIds(["youtube.com"]).error, /snowflake/);

    const tooMany = Array.from(
        { length: 51 },
        (_, index) => String(10000000000000000n + BigInt(index)),
    );
    assert.match(validateAllowedRoleIds(tooMany).error, /50/);
});

test("POST y PUT normalizan y persisten trigger y roles", async () => {
    const creates = [];
    const updates = [];
    const controller = createCustomCommandController({
        async Create(data) {
            creates.push(data);
            return { id: "command-1", ...data };
        },
        async Update(id, data) {
            updates.push({ id, data });
            return { id, ...data };
        },
    });

    const createRes = response();
    await controller.createCustomCommand({
        body: {
            ...validCommandBody,
            triggerType: "startsWith",
            allowedRoleIds: [ROLE_A, ROLE_A, ROLE_B],
        },
    }, createRes);

    const updateRes = response();
    await controller.updateCustomCommand({
        params: { id: "command-1" },
        body: {
            command: "!hola",
            code: validCommandBody.code,
        },
    }, updateRes);

    assert.equal(createRes.statusCode, 201);
    assert.equal(creates[0].triggerType, "startsWith");
    assert.deepEqual(creates[0].allowedRoleIds, [ROLE_A, ROLE_B]);
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updates[0].data.triggerType, "include");
    assert.deepEqual(updates[0].data.allowedRoleIds, []);
});

test("GET normaliza campos ausentes de comandos históricos", async () => {
    const controller = createCustomCommandController({
        async GetByServerId(serverId) {
            return [{
                id: "historical",
                serverId,
                command: "!viejo",
                code: validCommandBody.code,
                enabled: true,
            }];
        },
    });
    const res = response();

    await controller.getCustomCommands({
        query: { serverId: "server-1" },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data[0].triggerType, "include");
    assert.deepEqual(res.body.data[0].allowedRoleIds, []);
});

test("API rechaza trigger y roles inválidos antes de escribir", async () => {
    let writes = 0;
    const controller = createCustomCommandController({
        async Create() {
            writes += 1;
        },
        async Update() {
            writes += 1;
        },
    });
    const triggerRes = response();
    const rolesRes = response();

    await controller.createCustomCommand({
        body: { ...validCommandBody, triggerType: "contains" },
    }, triggerRes);
    await controller.updateCustomCommand({
        params: { id: "command-1" },
        body: {
            command: "!hola",
            code: validCommandBody.code,
            allowedRoleIds: {},
        },
    }, rolesRes);

    assert.equal(triggerRes.statusCode, 400);
    assert.equal(rolesRes.statusCode, 400);
    assert.equal(writes, 0);
});

test("DB Create y Update trasladan trigger y roles a Prisma", async (t) => {
    const writes = [];
    const originalCreate = prisma.customCommand.create;
    const originalUpdate = prisma.customCommand.update;
    prisma.customCommand.create = async (operation) => {
        writes.push(operation);
        return operation.data;
    };
    prisma.customCommand.update = async (operation) => {
        writes.push(operation);
        return operation.data;
    };
    t.after(() => {
        prisma.customCommand.create = originalCreate;
        prisma.customCommand.update = originalUpdate;
    });

    const db = new CustomCommand();
    await db.Create({
        ...validCommandBody,
        triggerType: "endsWith",
        allowedRoleIds: [ROLE_A],
    });
    await db.Update("command-1", {
        command: "!hola",
        code: validCommandBody.code,
        triggerType: "exact",
        allowedRoleIds: [ROLE_B],
    });

    assert.equal(writes[0].data.triggerType, "endsWith");
    assert.deepEqual(writes[0].data.allowedRoleIds, [ROLE_A]);
    assert.equal(writes[1].data.triggerType, "exact");
    assert.deepEqual(writes[1].data.allowedRoleIds, [ROLE_B]);
});

test("compiler conserva metadata y aplica defaults históricos", () => {
    const current = CompileCustomCommand({
        id: "current",
        serverId: "server-1",
        command: "!hola",
        triggerType: "exact",
        allowedRoleIds: [ROLE_A, ROLE_A, ""],
        code: validCommandBody.code,
    });
    const historical = CompileCustomCommand({
        id: "historical",
        serverId: "server-1",
        command: "!viejo",
        code: validCommandBody.code,
    });

    assert.equal(current.ok, true, JSON.stringify(current.diagnostics));
    assert.equal(current.value.compiledCommand.triggerType, "exact");
    assert.deepEqual(current.value.compiledCommand.allowedRoleIds, [ROLE_A]);
    assert.equal(Object.isFrozen(current.value.compiledCommand.allowedRoleIds), true);
    assert.equal(historical.value.compiledCommand.triggerType, "include");
    assert.deepEqual(historical.value.compiledCommand.allowedRoleIds, []);
});

test("matcher implementa los cuatro triggers", () => {
    const exact = compiled("exact", "!exact", "exact");
    const starts = compiled("starts", "!start", "startsWith");
    const ends = compiled("ends", "!end", "endsWith");
    const include = compiled("include", "middle", "include");
    const commands = new Map([
        [exact.command, exact],
        [starts.command, starts],
        [ends.command, ends],
        [include.command, include],
    ]);

    assert.equal(FindCustomCommandInServerMap(commands, "!exact"), exact);
    assert.equal(FindCustomCommandInServerMap(commands, "!exact extra"), null);
    assert.equal(FindCustomCommandInServerMap(commands, "!start value"), starts);
    assert.equal(FindCustomCommandInServerMap(commands, "value !end"), ends);
    assert.equal(FindCustomCommandInServerMap(commands, "a middle value"), include);
});

test("matcher respeta prioridad, longitud e ID como desempate", () => {
    const exact = compiled("z-exact", "!abc", "exact");
    const starts = compiled("z-start", "!a", "startsWith");
    const includeLong = compiled("z-include", "abc", "include");
    assert.equal(
        FindCustomCommandInServerMap(new Map([
            [starts.command, starts],
            [includeLong.command, includeLong],
            [exact.command, exact],
        ]), "!abc"),
        exact,
    );

    const short = compiled("short", "!a", "include");
    const long = compiled("long", "!abc", "include");
    assert.equal(
        FindCustomCommandInServerMap(
            new Map([[short.command, short], [long.command, long]]),
            "x !abc y",
        ),
        long,
    );

    const startsTie = compiled("b-id", "a", "startsWith");
    const endsTie = compiled("a-id", "b", "endsWith");
    assert.equal(
        FindCustomCommandInServerMap(
            new Map([[startsTie.command, startsTie], [endsTie.command, endsTie]]),
            "ab",
        ),
        endsTie,
    );
});

test("permisos usan OR, no tienen bypass admin y abren si todos son huérfanos", () => {
    const publicContext = createPermissionContext();
    assert.equal(
        HasCustomCommandPermission(publicContext.msg, compiled("public", "!x", "exact"), publicContext.member),
        true,
    );

    const orContext = createPermissionContext({ memberRoles: [ROLE_B] });
    assert.equal(
        HasCustomCommandPermission(
            orContext.msg,
            compiled("or", "!x", "exact", [ROLE_A, ROLE_B]),
            orContext.member,
        ),
        true,
    );

    const deniedAdmin = createPermissionContext({ administrator: true });
    assert.equal(
        HasCustomCommandPermission(
            deniedAdmin.msg,
            compiled("admin", "!x", "exact", [ROLE_A]),
            deniedAdmin.member,
        ),
        false,
    );

    const partialOrphan = createPermissionContext({ memberRoles: [] });
    assert.equal(
        HasCustomCommandPermission(
            partialOrphan.msg,
            compiled("partial", "!x", "exact", [ROLE_ORPHAN, ROLE_A]),
            partialOrphan.member,
        ),
        false,
    );
    assert.equal(
        HasCustomCommandPermission(
            partialOrphan.msg,
            compiled("orphans", "!x", "exact", [ROLE_ORPHAN]),
            partialOrphan.member,
        ),
        true,
    );
});

test("cache aísla servidores, omite disabled y runner valida permiso antes de ejecutar", async (t) => {
    const originalGetEnabled = CustomCommand.prototype.GetEnabled;
    CustomCommand.prototype.GetEnabled = async () => [
        {
            id: "enabled",
            serverId: "server-1",
            command: "!enabled",
            triggerType: "exact",
            allowedRoleIds: [],
            enabled: true,
            code: validCommandBody.code,
        },
        {
            id: "restricted",
            serverId: "server-1",
            command: "!restricted",
            triggerType: "exact",
            allowedRoleIds: [ROLE_A],
            enabled: true,
            code: validCommandBody.code,
        },
    ];
    t.after(() => {
        CustomCommand.prototype.GetEnabled = originalGetEnabled;
    });

    const summary = await LoadCustomCommandMap();
    assert.equal(summary.loaded, 2);
    assert.equal(GetCustomCommandFromMap("server-1", "!enabled").id, "enabled");
    assert.equal(GetCustomCommandFromMap("server-2", "!enabled"), null);
    assert.equal(GetCustomCommandFromMap("server-1", "!disabled"), null);

    const client = { user: { id: "bot-id" } };
    let sent = 0;
    const member = {
        id: AUTHOR_ID,
        roles: { cache: new Map() },
    };
    const denied = await RunCustomCommandInternal(client, {
        content: "!restricted",
        guild: {
            id: "server-1",
            roles: { cache: new Map([[ROLE_A, { id: ROLE_A }]]) },
            members: { cache: new Map([[AUTHOR_ID, member]]) },
        },
        member,
        author: { id: AUTHOR_ID, bot: false },
        channel: {
            async send() {
                sent += 1;
            },
        },
    });
    assert.equal(denied, false);
    assert.equal(sent, 0);

    assert.equal(await RunCustomCommandInternal(client, {
        content: "!enabled",
        guild: { id: "server-1" },
        author: { id: "another-bot", bot: true },
    }), false);
    assert.equal(await RunCustomCommandInternal(client, {
        content: "!enabled",
        guild: { id: "server-1" },
        author: { id: AUTHOR_ID, bot: false },
        webhookId: "webhook-id",
    }), false);
});
