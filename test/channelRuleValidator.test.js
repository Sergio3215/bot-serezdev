const test = require("node:test");
const assert = require("node:assert/strict");

const {
    ValidateLinkRestriction,
} = require("../commands/channelRules/validator.js");

const rule = (allowedTypes, mode = "contains", enabled = true) => ({
    type: "linkRestriction",
    allowedTypes,
    mode,
    enabled,
});

const isValid = (content, allowedTypes, mode = "contains") => (
    ValidateLinkRestriction(content, rule(allowedTypes, mode)).valid
);

test("acepta los hostnames y subdominios legítimos de cada plataforma", () => {
    const cases = [
        ["https://youtube.com/watch?v=1", "youtube"],
        ["https://www.youtube.com/watch?v=1", "youtube"],
        ["https://youtu.be/video", "youtube"],
        ["https://x.com/serezdev", "x"],
        ["https://mobile.twitter.com/serezdev", "x"],
        ["https://www.instagram.com/serezdev", "instagram"],
        ["https://clips.twitch.tv/example", "twitch"],
        ["https://kick.com/serezdev", "kick"],
    ];

    for (const [url, allowedType] of cases) {
        assert.equal(isValid(url, [allowedType]), true, url);
    }
});

test("rechaza hostnames que sólo contienen el nombre de una plataforma", () => {
    assert.equal(isValid("https://youtube.com.fake.com/video", ["youtube"]), false);
    assert.equal(isValid("https://notyoutube.com/video", ["youtube"]), false);
    assert.equal(isValid("https://youtube.com@fake.com/video", ["youtube"]), false);
});

test("https genérico sólo representa sitios no clasificados", () => {
    assert.equal(isValid("https://example.com/docs", ["https"]), true);
    assert.equal(isValid("https://youtube.com/watch?v=1", ["https"]), false);
});

test("rechaza HTTP aunque el tipo del hostname esté permitido", () => {
    const validation = ValidateLinkRestriction(
        "http://youtube.com/watch?v=1",
        rule(["youtube", "https"]),
    );

    assert.equal(validation.valid, false);
    assert.equal(validation.reason, "http-not-allowed");
});

test("contains permite texto pero exige que todos los enlaces estén permitidos", () => {
    assert.equal(isValid("Mira https://youtube.com/a por favor", ["youtube"]), true);
    assert.equal(isValid("mensaje sin links", ["youtube"]), false);
    assert.equal(
        isValid("https://youtube.com/a https://youtu.be/b", ["youtube"]),
        true,
    );
    assert.equal(
        isValid("https://youtube.com/a https://example.com/b", ["youtube"]),
        false,
    );
});

test("linksOnly acepta URLs y whitespace, pero rechaza texto adicional", () => {
    assert.equal(
        isValid("  https://youtube.com/a\nhttps://youtu.be/b  ", ["youtube"], "linksOnly"),
        true,
    );
    assert.equal(
        isValid("Mira https://youtube.com/a", ["youtube"], "linksOnly"),
        false,
    );
});

test("una regla deshabilitada no restringe el mensaje", () => {
    const validation = ValidateLinkRestriction(
        "texto sin enlaces",
        rule(["youtube"], "linksOnly", false),
    );

    assert.equal(validation.valid, true);
    assert.equal(validation.reason, "disabled");
});
