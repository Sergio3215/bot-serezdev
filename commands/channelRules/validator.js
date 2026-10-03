const CHANNEL_RULE_TYPES = new Set(["linkRestriction"]);
const ALLOWED_LINK_TYPES = new Set([
    "youtube",
    "x",
    "instagram",
    "twitch",
    "kick",
    "https",
]);
const LINK_RULE_MODES = new Set(["contains", "linksOnly"]);

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const TRAILING_PUNCTUATION = /[),.!?;:\\\]}>]+$/;

const hostMatches = (hostname, domain, allowSubdomains = true) => (
    hostname === domain
    || (allowSubdomains && hostname.endsWith(`.${domain}`))
);

const classifyHostname = (hostname) => {
    if (
        hostMatches(hostname, "youtube.com")
        || hostMatches(hostname, "youtu.be", false)
    ) {
        return "youtube";
    }

    if (hostMatches(hostname, "x.com") || hostMatches(hostname, "twitter.com")) {
        return "x";
    }

    if (hostMatches(hostname, "instagram.com")) return "instagram";
    if (hostMatches(hostname, "twitch.tv")) return "twitch";
    if (hostMatches(hostname, "kick.com")) return "kick";

    return "https";
};

const ExtractHttpUrls = (content) => {
    if (typeof content !== "string") {
        return { urls: [], invalid: true, nonUrlContent: "" };
    }

    const urls = [];
    const ranges = [];
    let invalid = false;

    for (const match of content.matchAll(URL_PATTERN)) {
        const candidate = match[0].replace(TRAILING_PUNCTUATION, "");

        if (candidate.length === 0) {
            invalid = true;
            continue;
        }

        try {
            const parsed = new URL(candidate);
            urls.push({
                value: candidate,
                url: parsed,
            });
            ranges.push({
                start: match.index,
                end: match.index + candidate.length,
            });
        } catch {
            invalid = true;
        }
    }

    let cursor = 0;
    let nonUrlContent = "";
    for (const range of ranges) {
        nonUrlContent += content.slice(cursor, range.start);
        cursor = range.end;
    }
    nonUrlContent += content.slice(cursor);

    return { urls, invalid, nonUrlContent };
};

const ValidateLinkRestriction = (content, rule) => {
    if (!rule || rule.enabled === false) {
        return { valid: true, reason: "disabled", urls: [] };
    }

    if (rule.type !== "linkRestriction") {
        return { valid: true, reason: "not-applicable", urls: [] };
    }

    if (
        !Array.isArray(rule.allowedTypes)
        || rule.allowedTypes.length === 0
        || !LINK_RULE_MODES.has(rule.mode)
    ) {
        return { valid: false, reason: "invalid-rule", urls: [] };
    }

    const extracted = ExtractHttpUrls(content);

    if (extracted.invalid) {
        return { valid: false, reason: "invalid-url", urls: extracted.urls };
    }

    if (extracted.urls.length === 0) {
        return { valid: false, reason: "no-links", urls: [] };
    }

    const allowedTypes = new Set(rule.allowedTypes);

    for (const extractedUrl of extracted.urls) {
        if (extractedUrl.url.protocol !== "https:") {
            return { valid: false, reason: "http-not-allowed", urls: extracted.urls };
        }

        const linkType = classifyHostname(extractedUrl.url.hostname.toLowerCase());
        if (!allowedTypes.has(linkType)) {
            return { valid: false, reason: "link-type-not-allowed", urls: extracted.urls };
        }
    }

    if (rule.mode === "linksOnly" && extracted.nonUrlContent.trim().length > 0) {
        return { valid: false, reason: "text-not-allowed", urls: extracted.urls };
    }

    return { valid: true, reason: "allowed", urls: extracted.urls };
};

module.exports = {
    CHANNEL_RULE_TYPES,
    ALLOWED_LINK_TYPES,
    LINK_RULE_MODES,
    ExtractHttpUrls,
    ValidateLinkRestriction,
    classifyHostname,
    hostMatches,
};
