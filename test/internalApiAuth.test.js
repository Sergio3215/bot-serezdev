const test = require("node:test");
const assert = require("node:assert/strict");
const { internalApiAuth } = require("../server/middleware/internalApiAuth");

function response() {
    return {
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
    };
}

test("rechaza requests sin bearer valido", () => {
    const previousSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = "secreto-interno";

    try {
        for (const header of [undefined, "Bearer incorrecto", "Basic secreto-interno"]) {
            const res = response();
            let called = false;
            internalApiAuth({ get: () => header }, res, () => { called = true; });

            assert.equal(res.statusCode, 401);
            assert.equal(called, false);
        }
    } finally {
        if (previousSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = previousSecret;
    }
});

test("acepta el bearer configurado", () => {
    const previousSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = "secreto-interno";

    try {
        const res = response();
        let called = false;
        internalApiAuth(
            { get: () => "Bearer secreto-interno" },
            res,
            () => { called = true; }
        );

        assert.equal(called, true);
        assert.equal(res.statusCode, 200);
    } finally {
        if (previousSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = previousSecret;
    }
});
