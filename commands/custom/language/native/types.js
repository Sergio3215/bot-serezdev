const TypeKind = Object.freeze({
    SCALAR: "scalar",
    OBJECT: "object",
    ARRAY: "array",
    UNION: "union",
});

const DeepFreeze = (value) => {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
        return value;
    }

    for (const child of Object.values(value)) {
        DeepFreeze(child);
    }

    return Object.freeze(value);
};

const Scalar = (name) => DeepFreeze({
    kind: TypeKind.SCALAR,
    name,
});

const ObjectType = (name, properties, options = {}) => DeepFreeze({
    kind: TypeKind.OBJECT,
    name,
    properties,
    readOnly: options.readOnly ?? false,
    additionalProperties: options.additionalProperties ?? false,
    ...(options.requiresAny === undefined ? {} : { requiresAny: options.requiresAny }),
});

const ArrayOf = (elementType, options = {}) => DeepFreeze({
    kind: TypeKind.ARRAY,
    name: `Array<${elementType.name}>`,
    elementType,
    readOnly: options.readOnly ?? false,
});

const UnionOf = (...types) => DeepFreeze({
    kind: TypeKind.UNION,
    name: types.map((type) => type.name).join(" | "),
    types,
});

const StringType = Scalar("String");
const NumberType = Scalar("Number");
const BooleanType = Scalar("Boolean");
const NullType = Scalar("Null");
const VoidType = Scalar("Void");
const AnyType = Scalar("Any");

const ChannelReferenceType = ObjectType("ChannelReference", {
    id: {
        type: StringType,
        required: true,
        readOnly: true,
        format: "snowflake",
    },
}, { readOnly: true });

const RoleReferenceType = ObjectType("RoleReference", {
    id: {
        type: StringType,
        required: true,
        readOnly: true,
        format: "snowflake",
    },
}, { readOnly: true });

const MemberType = ObjectType("Member", {
    id: {
        type: StringType,
        required: true,
        readOnly: true,
        format: "snowflake",
    },
    displayName: {
        type: StringType,
        required: true,
        readOnly: true,
    },
    bot: {
        type: BooleanType,
        required: true,
        readOnly: true,
    },
    roles: {
        type: ArrayOf(RoleReferenceType, { readOnly: true }),
        required: true,
        readOnly: true,
    },
}, { readOnly: true });

const EmbedAuthorType = ObjectType("EmbedAuthor", {
    name: {
        type: StringType,
        required: true,
        minLength: 1,
        maxLength: 256,
    },
    icon: {
        type: StringType,
        required: false,
        format: "http-url",
    },
    url: {
        type: StringType,
        required: false,
        format: "http-url",
    },
});

const EmbedFooterType = ObjectType("EmbedFooter", {
    text: {
        type: StringType,
        required: true,
        minLength: 1,
        maxLength: 2048,
    },
    icon: {
        type: StringType,
        required: false,
        format: "http-url",
    },
});

const EmbedProperties = {
    message: {
        type: StringType,
        required: false,
        minLength: 1,
        maxLength: 2000,
    },
    title: {
        type: StringType,
        required: false,
        minLength: 1,
        maxLength: 256,
    },
    description: {
        type: StringType,
        required: false,
        minLength: 1,
        maxLength: 4096,
    },
    color: {
        type: StringType,
        required: false,
        format: "hex-color",
    },
    url: {
        type: StringType,
        required: false,
        format: "http-url",
    },
    image: {
        type: StringType,
        required: false,
        format: "http-url",
    },
    author: {
        type: EmbedAuthorType,
        required: false,
    },
    footer: {
        type: EmbedFooterType,
        required: false,
    },
};

const SendMessageConfigType = ObjectType("SendMessageConfig", {
    channel: {
        type: ChannelReferenceType,
        required: false,
    },
    message: {
        type: StringType,
        required: true,
        minLength: 1,
        maxLength: 2000,
    },
});

const ReplyMessageConfigType = ObjectType("ReplyMessageConfig", {
    message: {
        type: StringType,
        required: true,
        minLength: 1,
        maxLength: 2000,
    },
});

const SendEmbedConfigType = ObjectType("SendEmbedConfig", {
    channel: {
        type: ChannelReferenceType,
        required: false,
    },
    ...EmbedProperties,
}, {
    requiresAny: ["title", "description", "color", "url", "image", "author", "footer"],
});

const ReplyEmbedConfigType = ObjectType("ReplyEmbedConfig", {
    ...EmbedProperties,
}, {
    requiresAny: ["title", "description", "color", "url", "image", "author", "footer"],
});

const NativeTypes = Object.freeze({
    String: StringType,
    Number: NumberType,
    Boolean: BooleanType,
    Null: NullType,
    Void: VoidType,
    Any: AnyType,
    ChannelReference: ChannelReferenceType,
    RoleReference: RoleReferenceType,
    Member: MemberType,
    EmbedAuthor: EmbedAuthorType,
    EmbedFooter: EmbedFooterType,
    SendMessageConfig: SendMessageConfigType,
    ReplyMessageConfig: ReplyMessageConfigType,
    SendEmbedConfig: SendEmbedConfigType,
    ReplyEmbedConfig: ReplyEmbedConfigType,
});

const IsType = (value) =>
    value !== null
    && typeof value === "object"
    && Object.values(TypeKind).includes(value.kind)
    && typeof value.name === "string";

const FormatType = (type) => {
    if (!IsType(type)) {
        throw new TypeError("Tipo nativo inválido");
    }

    return type.name;
};

module.exports = {
    TypeKind,
    NativeTypes,
    ArrayOf,
    UnionOf,
    IsType,
    FormatType,
    DeepFreeze,
};
