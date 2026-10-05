const {
    NativeTypes,
    ArrayOf,
    UnionOf,
    DeepFreeze,
    IsType,
    TypeKind,
} = require("./types.js");
const DefaultImplementations = require("./implementations.js");

const NativeEntryKind = Object.freeze({
    ACTION: "action",
    QUERY: "query",
    REFERENCE: "reference",
});

const NativeSyntax = Object.freeze({
    CALL: "call",
});

const NativeContext = Object.freeze({
    MESSAGE: "message",
});

const NativeRequirement = Object.freeze({
    MENTION: "mention",
});

const REGISTRY_ENTRIES = Symbol("registryEntries");

const Parameter = (name, type, required = true, options = {}) => ({
    name,
    type,
    required,
    ...options,
});

const ReturnType = (type, options = {}) => ({
    type,
    nullable: options.nullable ?? false,
    readOnly: options.readOnly ?? false,
    ...(options.elementTypeOfParameter === undefined
        ? {}
        : { elementTypeOfParameter: options.elementTypeOfParameter }),
});

const CreateMetadata = ({
    name,
    kind,
    parameters,
    returns,
    isAsync,
    requires = [],
}) => DeepFreeze({
    name,
    kind,
    syntax: NativeSyntax.CALL,
    parameters,
    returns,
    contexts: [NativeContext.MESSAGE],
    isAsync,
    requires,
});

const ValidateMetadata = (metadata) => {
    if (!metadata || typeof metadata !== "object") {
        throw new TypeError("Los metadatos de una función nativa son obligatorios");
    }

    if (typeof metadata.name !== "string" || metadata.name.length === 0) {
        throw new TypeError("El nombre de una función nativa es inválido");
    }

    if (!Object.values(NativeEntryKind).includes(metadata.kind)) {
        throw new TypeError(`Clase nativa inválida para ${metadata.name}`);
    }

    if (metadata.syntax !== NativeSyntax.CALL) {
        throw new TypeError(`Sintaxis nativa inválida para ${metadata.name}`);
    }

    if (!Array.isArray(metadata.parameters)) {
        throw new TypeError(`Los parámetros de ${metadata.name} son inválidos`);
    }

    for (const parameter of metadata.parameters) {
        if (
            !parameter
            || typeof parameter.name !== "string"
            || !IsType(parameter.type)
            || typeof parameter.required !== "boolean"
        ) {
            throw new TypeError(`Existe un parámetro inválido en ${metadata.name}`);
        }
    }

    if (!metadata.returns || !IsType(metadata.returns.type)) {
        throw new TypeError(`El retorno de ${metadata.name} es inválido`);
    }

    if (metadata.returns.elementTypeOfParameter !== undefined) {
        const parameterIndex = metadata.returns.elementTypeOfParameter;
        if (
            !Number.isInteger(parameterIndex)
            || parameterIndex < 0
            || metadata.parameters[parameterIndex]?.type?.kind !== TypeKind.ARRAY
        ) {
            throw new TypeError(`El retorno genérico de ${metadata.name} es inválido`);
        }
    }

    if (
        !Array.isArray(metadata.contexts)
        || metadata.contexts.length !== 1
        || metadata.contexts[0] !== NativeContext.MESSAGE
    ) {
        throw new TypeError(`El contexto de ${metadata.name} es inválido`);
    }

    if (typeof metadata.isAsync !== "boolean") {
        throw new TypeError(`isAsync es inválido en ${metadata.name}`);
    }

    if (
        !Array.isArray(metadata.requires)
        || metadata.requires.some((requirement) => (
            !Object.values(NativeRequirement).includes(requirement)
        ))
        || new Set(metadata.requires).size !== metadata.requires.length
    ) {
        throw new TypeError(`Los requisitos de ${metadata.name} son inválidos`);
    }
};

class NativeRegistry {
    constructor(entries) {
        const registryEntries = new Map();

        for (const entry of entries) {
            ValidateMetadata(entry.metadata);

            if (typeof entry.execute !== "function") {
                throw new TypeError(`La implementación de ${entry.metadata.name} es inválida`);
            }

            if (registryEntries.has(entry.metadata.name)) {
                throw new TypeError(`La función nativa ${entry.metadata.name} está duplicada`);
            }

            registryEntries.set(entry.metadata.name, DeepFreeze({
                metadata: entry.metadata,
                execute: entry.execute,
            }));
        }

        Object.defineProperty(this, REGISTRY_ENTRIES, {
            value: registryEntries,
            enumerable: false,
            configurable: false,
            writable: false,
        });
        Object.freeze(this);
    }

    get size() {
        return this[REGISTRY_ENTRIES].size;
    }

    has(name) {
        return this[REGISTRY_ENTRIES].has(name);
    }

    get(name) {
        return this[REGISTRY_ENTRIES].get(name) ?? null;
    }

    values() {
        return Object.freeze(Array.from(this[REGISTRY_ENTRIES].values()));
    }

    metadata() {
        return Object.freeze(
            Array.from(this[REGISTRY_ENTRIES].values(), (entry) => entry.metadata),
        );
    }

    [Symbol.iterator]() {
        return this.values()[Symbol.iterator]();
    }
}

const CreateNativeDefinitions = (implementations) => [
    {
        metadata: CreateMetadata({
            name: "string",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter(
                "value",
                UnionOf(NativeTypes.String, NativeTypes.Number, NativeTypes.Boolean),
            )],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.string(...args),
    },
    {
        metadata: CreateMetadata({
            name: "int",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter(
                "value",
                UnionOf(NativeTypes.Number, NativeTypes.String),
            )],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.int(...args),
    },
    {
        metadata: CreateMetadata({
            name: "decimal",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter(
                "value",
                UnionOf(NativeTypes.Number, NativeTypes.String),
            )],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.decimal(...args),
    },
    {
        metadata: CreateMetadata({
            name: "bool",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter(
                "value",
                UnionOf(NativeTypes.Boolean, NativeTypes.String),
            )],
            returns: ReturnType(NativeTypes.Boolean, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.bool(...args),
    },
    {
        metadata: CreateMetadata({
            name: "random",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.random(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "randomRange",
            kind: NativeEntryKind.QUERY,
            parameters: [
                Parameter("min", NativeTypes.Number),
                Parameter("max", NativeTypes.Number),
            ],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.randomRange(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "choose",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter("values", ArrayOf(NativeTypes.Any, { readOnly: true }))],
            returns: ReturnType(NativeTypes.Any, {
                readOnly: true,
                elementTypeOfParameter: 0,
            }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.choose(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "now",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.now(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "date",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.date(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "time",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.time(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "username",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.username(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "displayName",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.displayName(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "userId",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.userId(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "channelId",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.channelId(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "serverId",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.serverId(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "memberCount",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.memberCount(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "upper",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter("value", NativeTypes.String)],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.upper(...args),
    },
    {
        metadata: CreateMetadata({
            name: "lower",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter("value", NativeTypes.String)],
            returns: ReturnType(NativeTypes.String, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.lower(...args),
    },
    {
        metadata: CreateMetadata({
            name: "length",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter(
                "value",
                UnionOf(NativeTypes.String, ArrayOf(NativeTypes.Any, { readOnly: true })),
            )],
            returns: ReturnType(NativeTypes.Number, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.length(...args),
    },
    {
        metadata: CreateMetadata({
            name: "Channel",
            kind: NativeEntryKind.REFERENCE,
            parameters: [Parameter("channelId", NativeTypes.String, true, { format: "snowflake" })],
            returns: ReturnType(NativeTypes.ChannelReference, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.Channel(...args),
    },
    {
        metadata: CreateMetadata({
            name: "Role",
            kind: NativeEntryKind.REFERENCE,
            parameters: [Parameter("roleId", NativeTypes.String, true, { format: "snowflake" })],
            returns: ReturnType(NativeTypes.RoleReference, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.Role(...args),
    },
    {
        metadata: CreateMetadata({
            name: "GetMember",
            kind: NativeEntryKind.QUERY,
            parameters: [Parameter("userId", NativeTypes.String, true, { format: "snowflake" })],
            returns: ReturnType(NativeTypes.Member, { nullable: true, readOnly: true }),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.GetMember(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "GetMembers",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(ArrayOf(NativeTypes.Member, { readOnly: true }), { readOnly: true }),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.GetMembers(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "GetAuthor",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.Member, { readOnly: true }),
            isAsync: false,
        }),
        execute: (runtimeContext, args) => implementations.GetAuthor(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "GetMentionedMember",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(NativeTypes.Member, { readOnly: true }),
            isAsync: true,
            requires: [NativeRequirement.MENTION],
        }),
        execute: (runtimeContext, args) => implementations.GetMentionedMember(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "GetMentionedMembers",
            kind: NativeEntryKind.QUERY,
            parameters: [],
            returns: ReturnType(ArrayOf(NativeTypes.Member, { readOnly: true }), { readOnly: true }),
            isAsync: true,
            requires: [NativeRequirement.MENTION],
        }),
        execute: (runtimeContext, args) => implementations.GetMentionedMembers(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "HasRole",
            kind: NativeEntryKind.QUERY,
            parameters: [
                Parameter("member", NativeTypes.Member),
                Parameter("role", NativeTypes.RoleReference),
            ],
            returns: ReturnType(NativeTypes.Boolean, { readOnly: true }),
            isAsync: false,
        }),
        execute: (_runtimeContext, args) => implementations.HasRole(...args),
    },
    {
        metadata: CreateMetadata({
            name: "AddRole",
            kind: NativeEntryKind.ACTION,
            parameters: [
                Parameter("member", NativeTypes.Member),
                Parameter("role", NativeTypes.RoleReference),
            ],
            returns: ReturnType(NativeTypes.Void),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.AddRole(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "SendMessage",
            kind: NativeEntryKind.ACTION,
            parameters: [Parameter("config", NativeTypes.SendMessageConfig)],
            returns: ReturnType(NativeTypes.Void),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.SendMessage(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "ReplyMessage",
            kind: NativeEntryKind.ACTION,
            parameters: [Parameter("config", NativeTypes.ReplyMessageConfig)],
            returns: ReturnType(NativeTypes.Void),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.ReplyMessage(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "SendEmbed",
            kind: NativeEntryKind.ACTION,
            parameters: [Parameter("config", NativeTypes.SendEmbedConfig)],
            returns: ReturnType(NativeTypes.Void),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.SendEmbed(runtimeContext, ...args),
    },
    {
        metadata: CreateMetadata({
            name: "ReplyEmbed",
            kind: NativeEntryKind.ACTION,
            parameters: [Parameter("config", NativeTypes.ReplyEmbedConfig)],
            returns: ReturnType(NativeTypes.Void),
            isAsync: true,
        }),
        execute: (runtimeContext, args) => implementations.ReplyEmbed(runtimeContext, ...args),
    },
];

const CreateNativeRegistry = (implementations = DefaultImplementations) =>
    new NativeRegistry(CreateNativeDefinitions(implementations));

module.exports = {
    NativeEntryKind,
    NativeSyntax,
    NativeContext,
    NativeRequirement,
    NativeRegistry,
    CreateNativeRegistry,
};
