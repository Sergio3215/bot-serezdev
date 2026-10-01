const CreatePosition = (line, column, offset) => ({
    line,
    column,
    offset,
});

const CreateLocation = (start, end) => ({
    start: { ...start },
    end: { ...end },
});

const CreateDiagnostic = (phase, code, message, start, end = start) => ({
    phase,
    code,
    message,
    loc: CreateLocation(start, end),
});

module.exports = {
    CreatePosition,
    CreateLocation,
    CreateDiagnostic,
};
