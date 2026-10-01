const test = require("node:test");
const assert = require("node:assert/strict");

const {
    CompileCustomCommand,
    Native,
    NativeImplementations,
} = require("../commands/custom/language/index.js");
const {
    FindCustomCommandInServerMap,
} = require("../commands/custom/index.js");
const {
    ExecuteCompiledCustomCommand,
    MissingMentionMessage,
    PrepareRequiredContext,
    ResolveMessageAuthorMember,
} = require("../commands/custom/runner.js");

const IDS = Object.freeze({
    author: "111111111111111111",
    first: "222222222222222222",
    second: "333333333333333333",
    absent: "444444444444444444",
    role: "555555555555555555",
});

const CreateGuildMember = (id, displayName = id) => ({
    id,
    displayName,
    user: { bot: false },
    roles: {
        cache: new Map([[IDS.role, { id: IDS.role }]]),
    },
});

const CreateRuntimeContext = (content, memberIds = [IDS.author, IDS.first, IDS.second]) => {
    const members = new Map(
        memberIds.map((id) => [id, CreateGuildMember(id)]),
    );

    return {
        authorMember: members.get(IDS.author) ?? null,
        sourceMessage: { content },
        guild: {
            members: {
                cache: members,
                async fetch(id) {
                    const member = members.get(id);
                    if (!member) throw new Error("Unknown Member");
                    return member;
                },
            },
        },
    };
};

test("GetAuthor devuelve el autor como Member inmutable", () => {
    const author = NativeImplementations.GetAuthor(
        CreateRuntimeContext("!comando"),
    );

    assert.equal(author.id, IDS.author);
    assert.equal(author.bot, false);
    assert.equal(author.roles[0].id, IDS.role);
    assert.equal(Object.isFrozen(author), true);
    assert.equal(Object.isFrozen(author.roles), true);
});

test("el runtime no resuelve un autor que no pertenece al servidor", async () => {
    const author = await ResolveMessageAuthorMember({
        author: { id: IDS.absent },
        guild: {
            members: {
                cache: new Map(),
                async fetch() {
                    throw new Error("Unknown Member");
                },
            },
        },
    });

    assert.equal(author, null);
});

test("GetMentionedMember devuelve la primera mención válida", async () => {
    const mentioned = await NativeImplementations.GetMentionedMember(
        CreateRuntimeContext(`!darrol <@${IDS.first}> <@!${IDS.second}>`),
    );

    assert.equal(mentioned.id, IDS.first);
});

test("GetMentionedMembers conserva el orden de varias menciones", async () => {
    const members = await NativeImplementations.GetMentionedMembers(
        CreateRuntimeContext(`<@!${IDS.second}> !darrol <@${IDS.first}>`),
    );

    assert.deepEqual(members.map((member) => member.id), [IDS.second, IDS.first]);
    assert.equal(Object.isFrozen(members), true);
});

test("GetMentionedMembers elimina menciones duplicadas", async () => {
    const members = await NativeImplementations.GetMentionedMembers(
        CreateRuntimeContext(`<@${IDS.first}> !darrol <@!${IDS.first}>`),
    );

    assert.deepEqual(members.map((member) => member.id), [IDS.first]);
});

test("las menciones de rol, everyone y here no cuentan como miembros", async () => {
    const context = CreateRuntimeContext(
        `<@&${IDS.role}> @everyone @here !darrol <@${IDS.first}>`,
    );

    const first = await NativeImplementations.GetMentionedMember(context);
    const all = await NativeImplementations.GetMentionedMembers(context);

    assert.equal(first.id, IDS.first);
    assert.deepEqual(all.map((member) => member.id), [IDS.first]);
});

test("los usuarios que no pertenecen al servidor se omiten", async () => {
    const context = CreateRuntimeContext(
        `<@${IDS.absent}> !darrol <@${IDS.first}>`,
    );

    const first = await NativeImplementations.GetMentionedMember(context);
    const all = await NativeImplementations.GetMentionedMembers(context);

    assert.equal(first.id, IDS.first);
    assert.deepEqual(all.map((member) => member.id), [IDS.first]);
});

test("las tres consultas nativas compilan con sus tipos declarados", () => {
    const compilation = CompileCustomCommand({
        id: "command-id",
        serverId: "server-id",
        command: "!darrol",
        code: `
            const author = GetAuthor()
            if (HasRole(author, Role("${IDS.role}"))) {
                AddRole(GetMentionedMember(), Role("${IDS.role}"))
            }
            for (const member of GetMentionedMembers()) {
                AddRole(member, Role("${IDS.role}"))
            }
        `,
    });

    assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics));
    assert.deepEqual(compilation.value.compiledCommand.program.requirements, ["mention"]);
});

test("el requisito mention se detecta aunque la llamada esté dentro de un if", () => {
    const compilation = CompileCustomCommand({
        id: "command-id",
        serverId: "server-id",
        command: "!darrol",
        code: `
            if (HasRole(GetAuthor(), Role("${IDS.role}"))) {
                AddRole(GetMentionedMember(), Role("${IDS.role}"))
            }
        `,
    });

    assert.equal(compilation.ok, true, JSON.stringify(compilation.diagnostics));
    assert.deepEqual(compilation.value.compiledCommand.program.requirements, ["mention"]);
});

test("el requisito mention aborta antes de ejecutar cuando no hay miembros mencionados", async () => {
    const compilation = CompileCustomCommand({
        id: "command-id",
        serverId: "server-id",
        command: "!darrol",
        code: `AddRole(GetMentionedMember(), Role("${IDS.role}"))`,
    });
    const runtimeContext = CreateRuntimeContext("!darrol");
    const prepared = await PrepareRequiredContext(
        compilation.value.compiledCommand,
        runtimeContext,
    );

    assert.equal(prepared.ok, false);
    assert.equal(prepared.error, "MISSING_MENTION");
    assert.equal(MissingMentionMessage, "Tenés que mencionar a alguien para usar este comando.");
});

test("sin mención el bot responde el error antes de ejecutar cualquier instrucción", async () => {
    const compilation = CompileCustomCommand({
        id: "command-id",
        serverId: "server-id",
        command: "!darrol",
        code: `
            SendMessage({ message: "No debe enviarse" })
            AddRole(GetMentionedMember(), Role("${IDS.role}"))
        `,
    });
    const runtimeContext = CreateRuntimeContext("!darrol");
    let sentMessages = 0;
    let replyPayload = null;
    const msg = {
        content: "!darrol",
        author: { id: IDS.author },
        member: runtimeContext.authorMember,
        guild: runtimeContext.guild,
        channel: {
            async send() {
                sentMessages += 1;
            },
        },
        async reply(payload) {
            replyPayload = payload;
        },
    };

    const handled = await ExecuteCompiledCustomCommand(
        { user: { id: "999999999999999999" } },
        msg,
        compilation.value.compiledCommand,
    );

    assert.equal(handled, true);
    assert.equal(sentMessages, 0);
    assert.deepEqual(replyPayload, { content: MissingMentionMessage });
});

test("el requisito mention prepara miembros válidos para reutilizarlos en el executor", async () => {
    const compilation = CompileCustomCommand({
        id: "command-id",
        serverId: "server-id",
        command: "!darrol",
        code: `for (const member of GetMentionedMembers()) { AddRole(member, Role("${IDS.role}")) }`,
    });
    const runtimeContext = CreateRuntimeContext(
        `<@${IDS.absent}> !darrol <@${IDS.first}> <@${IDS.first}>`,
    );
    const prepared = await PrepareRequiredContext(
        compilation.value.compiledCommand,
        runtimeContext,
    );

    assert.equal(prepared.ok, true);
    assert.deepEqual(
        prepared.runtimeContext.mentionContext.mentionedMembers.map((member) => member.id),
        [IDS.first],
    );
    assert.equal(
        (await NativeImplementations.GetMentionedMember(prepared.runtimeContext)).id,
        IDS.first,
    );
});

test("el registro rechaza requisitos de ejecución desconocidos", () => {
    const authorEntry = Native.nativeRegistry.get("GetAuthor");

    assert.throws(
        () => new Native.NativeRegistry([{
            metadata: {
                ...authorEntry.metadata,
                requires: ["unknown"],
            },
            execute: authorEntry.execute,
        }]),
        /requisitos/,
    );
});

test("el trigger puede estar antes o después de la mención y gana el más largo", () => {
    const shortCommand = { id: "short" };
    const longCommand = { id: "long" };
    const commands = new Map([
        ["!dar", shortCommand],
        ["!darrol", longCommand],
    ]);

    assert.equal(
        FindCustomCommandInServerMap(commands, `!darrol <@${IDS.first}>`),
        longCommand,
    );
    assert.equal(
        FindCustomCommandInServerMap(commands, `<@${IDS.first}> !darrol`),
        longCommand,
    );
    assert.equal(FindCustomCommandInServerMap(commands, "sin comando"), null);
});
